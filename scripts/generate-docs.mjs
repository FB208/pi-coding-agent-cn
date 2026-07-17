import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHeadingSlugger } from "../lib/doc-links.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = join(root, "content");
const docsRoot = join(contentRoot, "docs");
const outputPath = join(root, "app", "generated-docs.json");
async function readJson(path) { return JSON.parse(await readFile(path, "utf8")); }

/** 提取 Markdown 中已有的显式 HTML 锚点。 */
function extractHtmlAnchorIds(markdown) {
  return [...markdown.matchAll(/<a\s+[^>]*id=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
}

/** 提取最终 Markdown 中的标题、行号与唯一锚点。 */
function extractHeadings(markdown) {
  const headings = [];
  const slug = createHeadingSlugger(extractHtmlAnchorIds(markdown));
  let fence = "";
  let lineNumber = 0;
  for (const line of markdown.split(/\r?\n/)) {
    lineNumber++;
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1] ?? "";
    if (marker) { fence = fence ? "" : marker[0]; continue; }
    if (fence) continue;
    const match = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (match) {
      const rawTitle = match[2].replace(/\s+#+$/, "");
      headings.push({
        level: match[1].length,
        title: rawTitle.replace(/[`*~]/g, ""),
        id: slug(rawTitle),
        line: lineNumber,
      });
    }
  }
  return headings;
}

/** 为中文标题补充缺少的官方英文别名，并保证重复执行结果不变。 */
function injectSourceAnchors(markdown, sourceHeadings) {
  const output = [];
  const reservedIds = new Set([
    ...extractHtmlAnchorIds(markdown),
    ...extractHeadings(markdown).map((heading) => heading.id),
  ]);
  let headingIndex = 0;
  let fence = "";
  for (const line of markdown.split(/\r?\n/)) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1] ?? "";
    if (marker) { fence = fence ? "" : marker[0]; output.push(line); continue; }
    const match = !fence && /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (match) {
      const source = sourceHeadings[headingIndex++];
      if (source?.id && !reservedIds.has(source.id)) {
        output.push(`<a id="${source.id}"></a>`);
        reservedIds.add(source.id);
      }
    }
    output.push(line);
  }
  return output.join("\n");
}

/** 从第一段正文中提取搜索摘要。 */
function extractDescription(markdown) {
  const body = markdown.replace(/^#\s+.*$/m, "").replace(/^>.*$/gm, "");
  return body.split(/\n\s*\n/).map((part) => part.replace(/\s+/g, " ").trim()).find((part) => part && !/^(import|<|```|#|[-*]\s)/.test(part))?.slice(0, 180) ?? "";
}

const [navigation, source, changelog, sourceStructure] = await Promise.all([
  readJson(join(contentRoot, "navigation.json")), readJson(join(contentRoot, "source.json")),
  readJson(join(contentRoot, "changelog.json")), readJson(join(contentRoot, "source-structure.json")),
]);
const documentItems = navigation.flatMap((group) => group.items).filter((item) => item.path.endsWith(".md"));
const docs = {};
for (const item of documentItems) {
  const originalMarkdown = await readFile(join(docsRoot, item.path), "utf8");
  const markdown = injectSourceAnchors(originalMarkdown, sourceStructure[item.path]?.headings ?? []);
  const headings = extractHeadings(markdown);
  docs[item.path.replace(/\.md$/, "")] = {
    ...item, markdown, description: extractDescription(originalMarkdown),
    headingIds: Object.fromEntries(headings.map((heading) => [heading.line, heading.id])),
    headings: headings.filter((heading) => heading.level > 1),
    sha256: createHash("sha256").update(originalMarkdown).digest("hex"),
  };
}
const output = `${JSON.stringify({ navigation, source, changelog, docs }, null, 2)}\n`;
let previous = "";
try { previous = await readFile(outputPath, "utf8"); } catch {}
if (previous !== output) await writeFile(outputPath, output, "utf8");
console.log(`已生成 ${Object.keys(docs).length} 个中文文档页面（Pi ${source.version}）。`);

