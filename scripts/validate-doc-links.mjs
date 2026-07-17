import { readFile } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import { createHeadingSlugger, resolveDocHref } from "../lib/doc-links.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 读取 UTF-8 JSON 文件。 */
async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

/** 提取 Markdown AST 节点的可见文本。 */
function nodeText(node) {
  if (typeof node?.value === "string") return node.value;
  return (node?.children ?? []).map(nodeText).join("");
}

/** 解码锚点；非法转义保留原值，便于给出准确错误。 */
function decodeHash(hash) {
  const value = hash.replace(/^#/, "");
  try { return decodeURIComponent(value); } catch { return value; }
}

/** 校验生成后的全部 Markdown 链接及锚点。 */
export async function validateDocLinks() {
  const generated = await readJson(join(root, "app", "generated-docs.json"));
  const pageIds = new Set(Object.keys(generated.docs));
  const parsed = new Map();
  const anchors = new Map();
  const errors = [];
  const counts = { internal: 0, anchor: 0, source: 0, external: 0 };

  for (const [pageId, doc] of Object.entries(generated.docs)) {
    const tree = unified().use(remarkParse).use(remarkGfm).parse(doc.markdown);
    const explicitAnchors = [...doc.markdown.matchAll(/<a\s+[^>]*id=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
    const slug = createHeadingSlugger(explicitAnchors);
    const pageAnchors = new Set(explicitAnchors);
    const anchorList = [...explicitAnchors];
    const generatedHeadings = [];
    visit(tree, "heading", (node) => {
      const computedId = slug(nodeText(node));
      const line = node.position?.start.line;
      const storedId = line ? doc.headingIds?.[line] : null;
      if (!storedId || storedId !== computedId) errors.push(`${doc.path}: 第 ${line ?? "?"} 行标题 ID 与生成映射不一致`);
      const id = storedId || computedId;
      pageAnchors.add(id);
      anchorList.push(id);
      if (node.depth > 1 && node.depth <= 4) generatedHeadings.push({ level: node.depth, id, line });
    });

    if (new Set(anchorList).size !== anchorList.length) errors.push(`${doc.path}: 生成了重复锚点`);
    if (generatedHeadings.length !== doc.headings.length) {
      errors.push(`${doc.path}: 目录标题数量与正文不一致`);
    } else {
      generatedHeadings.forEach((heading, index) => {
        const expected = doc.headings[index];
        if (heading.level !== expected.level || heading.id !== expected.id || heading.line !== expected.line) {
          errors.push(`${doc.path}: 第 ${index + 1} 个目录锚点与正文不一致`);
        }
      });
    }
    parsed.set(pageId, { tree, doc });
    anchors.set(pageId, pageAnchors);
  }

  for (const [pageId, { tree, doc }] of parsed) {
    visit(tree, ["link", "definition"], (node) => {
      const rawHref = String(node.url ?? "");
      let decodedHref = rawHref;
      try { decodedHref = decodeURIComponent(rawHref); } catch {}
      if (/\[[^\]]*\]\([^)]*\)/.test(decodedHref)) errors.push(`${doc.path}: 链接目标包含嵌套 Markdown：${rawHref}`);

      const resolved = resolveDocHref(rawHref, {
        pageIds,
        currentPage: pageId,
        source: generated.source,
      });
      if (resolved.kind === "empty" || resolved.kind === "invalid") {
        errors.push(`${doc.path}: 无效链接目标 ${rawHref || "<空>"}`);
        return;
      }
      if (/\[[^\]]*\]\(|\.md(?:x)?(?:[?#]|$)/i.test(resolved.href) && resolved.kind === "internal") {
        errors.push(`${doc.path}: 站内链接未规范化 ${resolved.href}`);
      }
      if (resolved.kind === "internal") {
        counts.internal++;
        if (!resolved.pageId || !pageIds.has(resolved.pageId)) errors.push(`${doc.path}: 指向不存在的中文页面 ${rawHref}`);
        if (resolved.pageId && resolved.hash && !anchors.get(resolved.pageId)?.has(decodeHash(resolved.hash))) {
          errors.push(`${doc.path}: 指向不存在的锚点 ${rawHref}`);
        }
        if (!resolved.href.startsWith("?page=")) errors.push(`${doc.path}: 站内链接不是查询式路由 ${resolved.href}`);
        return;
      }
      if (resolved.kind === "anchor") {
        counts.anchor++;
        if (!anchors.get(pageId)?.has(decodeHash(resolved.hash))) errors.push(`${doc.path}: 页内锚点不存在 ${rawHref}`);
        return;
      }
      counts[resolved.kind]++;
      if (!/^(?:https?:\/\/|mailto:|tel:)/i.test(resolved.href)) errors.push(`${doc.path}: 站外链接不是绝对地址 ${resolved.href}`);
    });
  }

  const regressionContext = {
    pageIds,
    currentPage: "index",
    source: generated.source,
  };
  const malformed = "https://pi-coding-agent-cn.yanghuichao.chatgpt.site/[quickstart](https://pi-coding-agent-cn.yanghuichao.chatgpt.site/quickstart.md).md";
  const recovered = resolveDocHref(malformed, regressionContext);
  if (recovered.href !== "?page=quickstart") errors.push("用户报告的嵌套错误地址未能恢复到快速开始页面");
  if (resolveDocHref("/docs/latest/tui", regressionContext).href !== "?page=tui") errors.push("官方快捷路由未能映射到 TUI 中文页");
  if (createHeadingSlugger()("set_steering_mode") !== "set_steering_mode") errors.push("标题锚点错误地删除了下划线");

  if (errors.length) throw new Error(`文档链接校验失败（${errors.length} 项）：\n- ${errors.join("\n- ")}`);
  return { pages: pageIds.size, links: Object.values(counts).reduce((sum, count) => sum + count, 0), counts };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await validateDocLinks();
  console.log(`链接校验通过：${report.pages} 个页面，${report.links} 个链接（站内 ${report.counts.internal}，页内 ${report.counts.anchor}，源码 ${report.counts.source}，外部 ${report.counts.external}）。`);
}

