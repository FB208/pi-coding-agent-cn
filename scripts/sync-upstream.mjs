import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHeadingSlugger } from "../lib/doc-links.mjs";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";

const REPOSITORY = "earendil-works/pi";
const REPOSITORY_URL = `https://github.com/${REPOSITORY}`;
const CODING_AGENT_ROOT = "packages/coding-agent";
const DOCS_ROOT = `${CODING_AGENT_ROOT}/docs`;
const PACKAGE_PATH = `${CODING_AGENT_ROOT}/package.json`;
const NAVIGATION_PATH = `${DOCS_ROOT}/docs.json`;
const COMPARE_FILE_LIMIT = 300;
const DEFAULT_MODEL = "openai/gpt-4.1";
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const markdownParser = unified().use(remarkParse).use(remarkGfm);

/** 生成稳定的 SHA-256。 */
export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

/** 解析 Markdown，并把语法错误转换为带文件名的异常。 */
function parseMarkdown(markdown, file) {
  try {
    return markdownParser.parse(markdown);
  } catch (error) {
    throw new Error(`${file} Markdown 解析失败：${error.message}`);
  }
}

/** 检查当前章节算法明确支持的标题和围栏语法。 */
function assertSupportedMarkdown(markdown, file, options = {}) {
  const tree = parseMarkdown(markdown, file);
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const headings = [];
  const visit = (node) => {
    if (node.type === "heading") {
      const line = lines[(node.position?.start.line ?? 1) - 1] ?? "";
      if (node.depth > 4 || !/^#{1,4}\s+/.test(line)) {
        throw new Error(`${file} 使用了暂不支持的 Setext 或五/六级标题（第 ${node.position?.start.line ?? "?"} 行）。`);
      }
      headings.push(node.depth);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  if ((options.requireH1 ?? true) && !headings.includes(1)) throw new Error(`${file} 缺少一级标题。`);

  let fence = null;
  for (const [index, line] of lines.entries()) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (!marker) continue;
    if (!fence) fence = { character: marker[0], length: marker.length, line: index + 1 };
    else if (marker[0] === fence.character && marker.length >= fence.length) fence = null;
  }
  if (fence) throw new Error(`${file} 的代码围栏未闭合（始于第 ${fence.line} 行）。`);
  return tree;
}

/** 按 H1-H4 标题切分 Markdown，并把官方锚点与其后的标题绑定。 */
export function splitMarkdownSections(markdown, file = "Markdown", options = {}) {
  assertSupportedMarkdown(markdown, file, options);
  const starts = [];
  const records = markdown.match(/[^\n]*(?:\n|$)/g) ?? [];
  let offset = 0;
  let fence = null;
  let pendingAnchorOffset = null;
  for (const rawLine of records) {
    if (!rawLine && offset >= markdown.length) break;
    const line = rawLine.replace(/\r?\n$/, "");
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      pendingAnchorOffset = null;
      if (!fence) fence = { character: marker[0], length: marker.length };
      else if (marker[0] === fence.character && marker.length >= fence.length) fence = null;
      offset += rawLine.length;
      continue;
    }
    if (!fence) {
      if (/^<a id=(["'])[^"']+\1><\/a>\s*$/u.test(line)) {
        pendingAnchorOffset = offset;
        offset += rawLine.length;
        continue;
      }
      const heading = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
      if (heading) {
        starts.push({ offset: pendingAnchorOffset ?? offset, level: heading[1].length, title: heading[2].replace(/\s+#+$/, "").trim() });
      }
      pendingAnchorOffset = null;
    }
    offset += rawLine.length;
  }

  const firstOffset = starts[0]?.offset ?? markdown.length;
  const sections = [{ kind: "preamble", level: 0, title: "", raw: markdown.slice(0, firstOffset) }];
  starts.forEach((start, index) => {
    const end = starts[index + 1]?.offset ?? markdown.length;
    sections.push({ kind: "heading", level: start.level, title: start.title, raw: markdown.slice(start.offset, end) });
  });
  return sections;
}

/** 提取源文档哈希和标题结构，并按页面顺序处理重复标题。 */
export function analyzeMarkdown(markdown, file = "Markdown") {
  const sections = splitMarkdownSections(markdown, file);
  const makeSlug = createHeadingSlugger();
  return {
    headings: sections.filter((section) => section.kind === "heading").map((section) => ({
      level: section.level,
      id: makeSlug(section.title),
    })),
  };
}

/** 提取 HTML 标签和属性，忽略标签之间允许翻译的自然语言。 */
function htmlStructure(value) {
  return [...value.matchAll(/<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/g)].map((match) => match[0]);
}

/** 生成忽略自然语言、保留 Markdown 语义结构的递归签名。 */
function structuralNode(node) {
  const result = { type: node.type };
  if (node.type === "heading") result.depth = node.depth;
  if (node.type === "link" || node.type === "image") {
    result.url = node.url;
    result.title = node.title ?? null;
  }
  if (["definition", "linkReference", "imageReference", "footnoteDefinition", "footnoteReference"].includes(node.type)) {
    result.identifier = node.identifier ?? null;
    result.label = node.label ?? null;
    if (node.url !== undefined) result.url = node.url;
    if (node.title !== undefined) result.title = node.title ?? null;
  }
  if (node.type === "code") {
    result.lang = node.lang ?? null;
    result.meta = node.meta ?? null;
    result.value = node.value;
  }
  if (node.type === "inlineCode") result.value = node.value;
  if (node.type === "html") result.structure = htmlStructure(node.value);
  if (node.type === "list") {
    result.ordered = node.ordered;
    result.start = node.start ?? null;
    result.spread = Boolean(node.spread);
  }
  if (node.type === "listItem") {
    result.checked = node.checked ?? null;
    result.spread = Boolean(node.spread);
  }
  if (node.type === "table") result.align = node.align ?? [];
  if (node.type === "text") return result;
  if (node.children) result.children = node.children.map(structuralNode);
  return result;
}

const SOURCE_ANCHOR = /^<a id=(["'])([^"']+)\1><\/a>\r?\n/u;

/** 校验可选的中文显式锚点，并返回移除官方锚点后的 Markdown。 */
function stripSourceHeadingAnchors(sourceMarkdown, translated, file, options = {}) {
  const syntaxOptions = { requireH1: options.requireH1 ?? true };
  const sourceSections = splitMarkdownSections(sourceMarkdown, `${file}（英文锚点）`, syntaxOptions);
  const translatedSections = splitMarkdownSections(translated, `${file}（中文锚点）`, syntaxOptions);
  if (sourceSections.length !== translatedSections.length) throw new Error(`${file} 的英文与中文章节数量不一致。`);
  const makeSlug = createHeadingSlugger();
  const expectedAnchors = sourceSections.map((section) => section.kind === "heading" ? makeSlug(section.title) : null);
  return translatedSections.map((section, index) => {
    const sourceSection = sourceSections[index];
    if (sourceSection.level !== section.level) throw new Error(`${file} 第 ${index + 1} 个章节标题层级不一致。`);
    if (section.kind !== "heading" || SOURCE_ANCHOR.test(sourceSection.raw)) return section.raw;
    const anchor = SOURCE_ANCHOR.exec(section.raw);
    if (!anchor) {
      if (options.requireSourceAnchors) throw new Error(`${file} 的“${sourceSection.title}”章节缺少官方锚点 ${expectedAnchors[index]}。`);
      return section.raw;
    }
    if ((options.validatePresentAnchors ?? true) && anchor[2] !== expectedAnchors[index]) {
      throw new Error(`${file} 的“${sourceSection.title}”章节锚点应为 ${expectedAnchors[index]}，实际为 ${anchor[2]}。`);
    }
    return section.raw.slice(anchor[0].length);
  }).join("");
}

/** 为需要持久化别名的翻译结果补上官方英文标题锚点。 */
export function addSourceHeadingAnchors(sourceMarkdown, translated, file = "Markdown", options = {}) {
  const syntaxOptions = { requireH1: options.requireH1 ?? true };
  const sourceSections = splitMarkdownSections(sourceMarkdown, `${file}（英文锚点源）`, syntaxOptions);
  const translatedSections = splitMarkdownSections(translated, `${file}（中文锚点源）`, syntaxOptions);
  if (sourceSections.length !== translatedSections.length) throw new Error(`${file} 无法添加锚点：英文与中文章节数量不一致。`);
  const makeSlug = createHeadingSlugger();
  const expectedAnchors = sourceSections.map((section) => section.kind === "heading" ? makeSlug(section.title) : null);
  return translatedSections.map((section, index) => {
    const sourceSection = sourceSections[index];
    if (sourceSection.level !== section.level) throw new Error(`${file} 无法添加锚点：第 ${index + 1} 个章节标题层级不一致。`);
    if (section.kind !== "heading" || SOURCE_ANCHOR.test(sourceSection.raw)) return section.raw;
    const anchor = SOURCE_ANCHOR.exec(section.raw);
    if (anchor) {
      if (anchor[2] !== expectedAnchors[index]) throw new Error(`${file} 的模型结果包含错误锚点 ${anchor[2]}，预期 ${expectedAnchors[index]}。`);
      return section.raw;
    }
    return `<a id="${expectedAnchors[index]}"></a>\n${section.raw}`;
  }).join("");
}

/** 读取并要求 YAML 风格前置元数据逐字不变。 */
function frontmatter(markdown) {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) return "";
  const end = normalized.indexOf("\n---\n", 4);
  return end < 0 ? "" : normalized.slice(0, end + 5);
}

const TECHNICAL_ONLY_WORD = /^(?:pi|api|sdk|rpc|json|tui|html|css|javascript|typescript|node|npm|windows|termux|tmux|shell|openai)$/iu;
const TECHNICAL_LITERAL_PATTERN = /--[A-Za-z][A-Za-z0-9_-]*|@[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+|\b(?=[A-Za-z0-9@._/-]*(?:\d|[-_.]))[A-Za-z0-9@._-]+\/[A-Za-z0-9@._/-]+\b|\b(?=[A-Za-z0-9-]*\d)[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+\b|\b(?:Pi|API|SDK|RPC|JSON|TUI|HTML|CSS|JavaScript|TypeScript|Node(?:\.js)?|npm|Windows|Termux|tmux|Shell|OpenAI)\b|\b(?:true|false|null|undefined|NaN|Infinity)\b|\b[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+\b|\b[A-Za-z]+(?:[A-Z][A-Za-z0-9]*)+\b|\b[A-Z]{2,}[0-9]*\b|[-+]?\b(?:0x[0-9A-Fa-f]+|\d+(?:\.\d+)*(?:[eE][-+]?\d+)?)\b/g;

/** 判断一段纯文本是否含有应翻译的英文自然语言。 */
function containsTranslatableEnglish(value) {
  return [...value.matchAll(/[A-Za-z][A-Za-z0-9_-]+/g)].some((match) => {
    const token = match[0];
    return !/^[A-Z0-9_-]+$/.test(token) && !TECHNICAL_ONLY_WORD.test(token) && !/[a-z][A-Z]/.test(token);
  });
}

/** 从 HTML 节点中提取自然语言，排除 pre/code 内容和标签本身。 */
function htmlNaturalLanguage(value) {
  return value
    .replace(/<(pre|code)\b[^>]*>[\s\S]*?<\/\1>/giu, " ")
    .replace(/<[^>]+>/g, " ");
}

/** 判断章节是否含有应被翻译的英文自然语言。 */
function hasTranslatableProse(tree) {
  const values = [];
  const visit = (node) => {
    if (node.type === "text") values.push(node.value);
    else if (node.type === "html") values.push(htmlNaturalLanguage(node.value));
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return values.some(containsTranslatableEnglish);
}

/** 从纯文本中提取不得翻译的技术标识、命令和示例值。 */
function extractTechnicalLiterals(value) {
  return [...value.matchAll(TECHNICAL_LITERAL_PATTERN)].map((match) => match[0]);
}

/** 收集 Markdown 文本和 HTML 节点中不得翻译的技术字面量。 */
function technicalLiterals(tree) {
  const result = [];
  const visit = (node) => {
    if (node.type === "text" || node.type === "html") result.push(...extractTechnicalLiterals(node.value));
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return result.sort();
}

/** 拒绝模型对 Markdown 结构、地址、代码、锚点和技术字面量的改动。 */
export function validateTranslatedStructure(sourceMarkdown, translated, file = "Markdown", options = {}) {
  const syntaxOptions = { requireH1: options.requireH1 ?? true };
  const sourceTree = assertSupportedMarkdown(sourceMarkdown, `${file}（英文）`, syntaxOptions);
  const normalizedTranslated = stripSourceHeadingAnchors(sourceMarkdown, translated, file, {
    ...syntaxOptions,
    requireSourceAnchors: options.requireSourceAnchors ?? false,
  });
  const translatedTree = assertSupportedMarkdown(normalizedTranslated, `${file}（中文）`, syntaxOptions);
  const errors = [];
  if (frontmatter(sourceMarkdown) !== frontmatter(normalizedTranslated)) errors.push("前置元数据变化");
  if (JSON.stringify(structuralNode(sourceTree)) !== JSON.stringify(structuralNode(translatedTree))) errors.push("Markdown 语义结构变化");
  if (JSON.stringify(technicalLiterals(sourceTree)) !== JSON.stringify(technicalLiterals(translatedTree))) errors.push("技术字面量变化");
  const requireChinese = options.requireChinese ?? hasTranslatableProse(sourceTree);
  if (requireChinese && !/[\u3400-\u9fff]/u.test(translated)) errors.push("存在可翻译自然语言但结果没有中文");
  if (errors.length) throw new Error(`${file} 翻译校验失败：${errors.join("、")}`);
  return true;
}

/** 校验现有中文只需证明章节映射安全；历史内容本身必须逐字节复用。 */
export function validateLegacyTranslation(sourceMarkdown, translated, file = "Markdown", options = {}) {
  const syntaxOptions = { requireH1: options.requireH1 ?? true };
  const sourceSections = splitMarkdownSections(sourceMarkdown, `${file}（英文基线）`, syntaxOptions);
  const translatedSections = splitMarkdownSections(translated, `${file}（中文基线）`, syntaxOptions);
  if (sourceSections.length !== translatedSections.length) throw new Error(`${file} 现有中文基线的章节数量不一致。`);
  sourceSections.forEach((section, index) => {
    if (section.level !== translatedSections[index].level) throw new Error(`${file} 现有中文基线第 ${index + 1} 个章节标题层级不一致。`);
  });
  if (frontmatter(sourceMarkdown) !== frontmatter(translated)) throw new Error(`${file} 现有中文基线的前置元数据变化。`);
  return true;
}

/** 按顶层 Markdown 节点安全切分超长输入，不切开代码块、表格或列表。 */
export function splitMarkdownForModel(markdown, limit = 18000, file = "Markdown") {
  if (markdown.length <= limit) return [markdown];
  const tree = parseMarkdown(markdown, file);
  const children = tree.children ?? [];
  if (!children.length) throw new Error(`${file} 超过 ${limit} 字符且无法安全分块。`);
  const starts = [0, ...children.slice(1).map((node) => node.position?.start.offset).filter(Number.isInteger)];
  const blocks = starts.map((start, index) => markdown.slice(start, starts[index + 1] ?? markdown.length));
  if (blocks.some((block) => block.length > limit)) throw new Error(`${file} 含有超过 ${limit} 字符的单个 Markdown 结构，拒绝不安全切分。`);
  const parts = [];
  let current = "";
  for (const block of blocks) {
    if (current && current.length + block.length > limit) {
      parts.push(current);
      current = "";
    }
    current += block;
  }
  if (current) parts.push(current);
  return parts;
}

/** 合并修改页面，只把无法按旧英文哈希复用的章节交给翻译器。 */
export async function mergeIncrementalTranslation({ oldSource, newSource, oldTranslation, file, translateSection }) {
  const oldSections = splitMarkdownSections(oldSource, `${file}（旧英文）`);
  const newSections = splitMarkdownSections(newSource, `${file}（新英文）`);
  const translatedSections = splitMarkdownSections(oldTranslation, `${file}（现有中文）`);
  if (oldSections.length !== translatedSections.length) {
    throw new Error(`${file} 无法安全增量合并：旧英文有 ${oldSections.length} 个章节，现有中文有 ${translatedSections.length} 个章节。`);
  }
  oldSections.forEach((section, index) => {
    if (section.level !== translatedSections[index].level) {
      throw new Error(`${file} 无法安全增量合并：第 ${index + 1} 个章节标题层级不一致。`);
    }
  });
  validateLegacyTranslation(oldSource, oldTranslation, `${file}（现有中文）`, { requireSourceAnchors: false });

  // 忽略章节边界处的尾随空白，使末章移动到中间时仍可复用原中文。
  const sectionHash = (raw) => sha256(raw.replace(/\r\n?/g, "\n").trimEnd());

  const byHash = new Map();
  oldSections.forEach((section, index) => {
    const hash = sectionHash(section.raw);
    if (!byHash.has(hash)) byHash.set(hash, []);
    byHash.get(hash).push(index);
  });
  for (const indexes of byHash.values()) {
    const variants = new Set(indexes.map((index) => translatedSections[index].raw));
    if (variants.size > 1) throw new Error(`${file} 存在英文内容相同但中文不同的重复章节，拒绝不确定映射。`);
  }

  const used = new Set();
  const output = [];
  const changedSectionTitles = [];
  let reusedCount = 0;
  let translatedCount = 0;
  for (const section of newSections) {
    const hash = sectionHash(section.raw);
    const match = (byHash.get(hash) ?? []).find((index) => !used.has(index));
    if (match !== undefined) {
      used.add(match);
      output.push(translatedSections[match].raw);
      reusedCount += 1;
      continue;
    }
    changedSectionTitles.push(section.title || "前言");
    if (!section.raw.trim()) {
      output.push(section.raw);
      continue;
    }
    const translated = await translateSection(section.raw, file, section.title || "前言");
    validateTranslatedStructure(section.raw, translated, `${file} / ${section.title || "前言"}`, { requireH1: false, requireSourceAnchors: false });
    output.push(translated);
    translatedCount += 1;
  }
  const markdown = output.join("");
  validateLegacyTranslation(newSource, markdown, file, { requireSourceAnchors: false });
  return { markdown, reusedSections: reusedCount, translatedSections: translatedCount, changedSectionTitles };
}

/** 识别 Compare API 路径所属的同步类型。 */
function classifyPath(path) {
  if (!path) return null;
  if (path === PACKAGE_PATH) return { kind: "package", path };
  if (path === NAVIGATION_PATH) return { kind: "navigation", path };
  const doc = new RegExp(`^${DOCS_ROOT.replaceAll("/", "\\/")}\\/([^/]+\\.md)$`, "u").exec(path);
  if (doc) return { kind: "doc", path: doc[1] };
  const image = new RegExp(`^${DOCS_ROOT.replaceAll("/", "\\/")}\\/images\\/(.+)$`, "u").exec(path);
  if (image) return { kind: "image", path: image[1] };
  return null;
}

/** 拒绝 Windows 不安全或可能发生大小写冲突的相对路径。 */
export function validateRelativePath(path, label = "路径") {
  if (!path || path.includes("\\") || path.startsWith("/") || /^[A-Za-z]:/.test(path)) throw new Error(`${label}不是安全的相对路径：${path}`);
  for (const segment of path.split("/")) {
    const stem = segment.split(".")[0];
    if (!segment || segment === "." || segment === ".." || /[<>:"|?*\u0000-\u001f]/u.test(segment) || /[ .]$/u.test(segment)) {
      throw new Error(`${label}包含 Windows 不安全片段：${path}`);
    }
    if (/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/iu.test(stem)) throw new Error(`${label}包含 Windows 保留名称：${path}`);
  }
  return path;
}

/** 生成 Windows 文件系统用于冲突比较的路径键。 */
function windowsPathKey(path) {
  return path.normalize("NFC").toLocaleLowerCase("en-US");
}

/** 拒绝多个目标路径在 Windows 下折叠为同一文件。 */
export function assertNoWindowsPathCollisions(paths, label = "目标文件") {
  const seen = new Map();
  for (const path of paths) {
    validateRelativePath(path, label);
    const key = windowsPathKey(path);
    if (seen.has(key) && seen.get(key) !== path) throw new Error(`${label}在 Windows 下冲突：${seen.get(key)} 与 ${path}`);
    seen.set(key, path);
  }
}

/** 将 Compare API 响应转换为确定性的文档更新计划。 */
export function buildComparePlan({ baseSha, targetSha, currentVersion, targetVersion, compare }) {
  if (!["ahead", "identical"].includes(compare?.status)) throw new Error(`上游比较状态为 ${compare?.status ?? "<缺失>"}，只接受 ahead 或 identical。`);
  if (compare.status === "ahead" && compare.merge_base_commit?.sha !== baseSha) throw new Error("上游比较的合并基线与 content/source.json 不一致。" );
  const files = compare.status === "identical" ? (compare.files ?? []) : compare.files;
  if (!Array.isArray(files)) throw new Error("GitHub Compare API 未返回完整的 files 列表。" );
  if (files.length >= COMPARE_FILE_LIMIT) throw new Error(`GitHub Compare API 返回 ${files.length} 个文件，可能已达到 ${COMPARE_FILE_LIMIT} 文件上限。`);

  const docs = [];
  const images = [];
  let packageChanged = false;
  let navigationChanged = false;
  for (const entry of files) {
    if (!entry || typeof entry.filename !== "string" || typeof entry.status !== "string") throw new Error("GitHub Compare API 含有缺少文件名或状态的条目。" );
    const oldFilename = entry.status === "added" ? null : entry.status === "renamed" ? entry.previous_filename : entry.filename;
    const newFilename = entry.status === "removed" ? null : entry.filename;
    if (entry.status === "renamed" && typeof entry.previous_filename !== "string") throw new Error(`${entry.filename} 是重命名条目但缺少 previous_filename。`);
    const oldType = classifyPath(oldFilename);
    const newType = classifyPath(newFilename);
    if (!oldType && !newType) continue;
    if (!["added", "modified", "removed", "renamed"].includes(entry.status)) throw new Error(`${entry.filename} 使用了不支持的文件状态 ${entry.status}。`);

    const fixedKind = oldType?.kind === "package" || newType?.kind === "package" ? "package" : oldType?.kind === "navigation" || newType?.kind === "navigation" ? "navigation" : null;
    if (fixedKind) {
      if (oldType?.kind !== fixedKind || newType?.kind !== fixedKind || oldType.path !== newType.path) throw new Error(`${fixedKind} 固定文件被新增、删除或重命名，拒绝继续。`);
      if (fixedKind === "package") packageChanged = true;
      else navigationChanged = true;
      continue;
    }
    if (oldType && newType && oldType.kind !== newType.kind) throw new Error(`${entry.filename} 在文档与图片类型之间移动，拒绝继续。`);
    const kind = oldType?.kind ?? newType?.kind;
    const operation = {
      status: !oldType ? "added" : !newType ? "removed" : oldType.path === newType.path ? "modified" : "renamed",
      oldPath: oldType?.path ?? null,
      newPath: newType?.path ?? null,
    };
    if (operation.oldPath) validateRelativePath(operation.oldPath, `${kind} 旧路径`);
    if (operation.newPath) validateRelativePath(operation.newPath, `${kind} 新路径`);
    if (operation.status === "renamed" && windowsPathKey(operation.oldPath) === windowsPathKey(operation.newPath)) {
      throw new Error(`${kind} 暂不安全处理仅大小写或 Unicode 形式变化的重命名：${operation.oldPath} → ${operation.newPath}`);
    }
    (kind === "doc" ? docs : images).push(operation);
  }
  assertNoWindowsPathCollisions(docs.map((item) => item.newPath).filter(Boolean), "中文文档目标路径");
  assertNoWindowsPathCollisions(images.map((item) => item.newPath).filter(Boolean), "文档图片目标路径");
  const versionChanged = currentVersion !== targetVersion;
  const hasRelevantChanges = packageChanged || navigationChanged || versionChanged || docs.length > 0 || images.length > 0;
  return {
    baseSha,
    targetSha,
    currentVersion,
    targetVersion,
    packageChanged,
    navigationChanged,
    versionChanged,
    docs,
    images,
    hasRelevantChanges,
    checkpointOnly: !hasRelevantChanges && baseSha !== targetSha,
    unchanged: !hasRelevantChanges && baseSha === targetSha,
  };
}

/** 创建认证可选的 JSON 请求，错误信息绝不包含令牌。 */
async function requestJson(url, { token, ...init } = {}) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(init.headers ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) throw new Error(`${url} 请求失败：${response.status} ${await response.text()}`);
  return response.json();
}

/** 从同一个不可变提交 SHA 读取上游文本或二进制内容。 */
async function fetchPinned(sha, path, binary = false) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`https://raw.githubusercontent.com/${REPOSITORY}/${sha}/${encodedPath}`);
  if (!response.ok) throw new Error(`读取上游 ${path}@${sha.slice(0, 12)} 失败：${response.status}`);
  return binary ? Buffer.from(await response.arrayBuffer()) : response.text();
}

/** 读取 UTF-8 JSON。 */
async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

/** 把上游相对路径安全映射到指定本地目录。 */
function localPath(base, upstreamRelative, label) {
  validateRelativePath(upstreamRelative, label);
  const result = resolve(base, ...upstreamRelative.split("/"));
  const prefix = `${resolve(base)}${sep}`.toLocaleLowerCase("en-US");
  if (!result.toLocaleLowerCase("en-US").startsWith(prefix)) throw new Error(`${label}逃逸目标目录：${upstreamRelative}`);
  return result;
}

/** 调用 GitHub Models；只在确实有新自然语言需要翻译时要求令牌。 */
async function modelCompletion(content, { token, model }) {
  if (!token) throw new Error("存在需要翻译的新内容，但缺少 GITHUB_TOKEN。" );
  const response = await requestJson("https://models.github.ai/inference/chat/completions", {
    token,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0.1, messages: [{ role: "user", content }] }),
  });
  const output = response.choices?.[0]?.message?.content;
  if (typeof output !== "string" || !output.trim()) throw new Error("翻译模型没有返回内容。" );
  return output.trimEnd();
}

/** 翻译一个页面或变化章节，失败时只重试当前输入一次。 */
async function translateMarkdown(markdown, file, context) {
  const tree = parseMarkdown(markdown, file);
  if (!hasTranslatableProse(tree)) return markdown;
  const parts = splitMarkdownForModel(markdown, 18000, file);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const output = [];
    for (let index = 0; index < parts.length; index += 1) {
      const prompt = `逐句忠实翻译下面的 Pi Coding Agent Markdown 为简体中文，不摘要、不删节、不补充。严格保持 Markdown/HTML 结构、标题级别、链接目标、图片路径、引用标识、围栏代码块、行内代码、表格和列表原样；只翻译自然语言、标题及链接文字。API、类型、变量、命令和示例值保持英文。这是 ${file} 的${context ? `“${context}”章节` : "新增页面"}，第 ${index + 1}/${parts.length} 段。只返回 Markdown。\n\n${parts[index]}`;
      output.push(await modelCompletion(prompt, contextOptions));
    }
    const result = `${output.join("\n\n").trimEnd()}\n`;
    try {
      validateTranslatedStructure(markdown, result, `${file}${context ? ` / ${context}` : ""}`, { requireH1: !context });
      return result;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

let contextOptions = { token: process.env.GITHUB_TOKEN, model: process.env.TRANSLATION_MODEL || DEFAULT_MODEL };

/** 校验导航翻译包含所需中文并保留技术字面量。 */
export function validateNavigationTranslation(label, output) {
  const errors = [];
  if (output !== output.trim() || /[\r\n]/u.test(output) || output.length > 80 || !output) errors.push("不是单行纯文本");
  if (/^["'“”].*["'“”]$/u.test(output)) errors.push("包含多余引号");
  if (JSON.stringify(extractTechnicalLiterals(label).sort()) !== JSON.stringify(extractTechnicalLiterals(output).sort())) errors.push("技术字面量变化");
  if (containsTranslatableEnglish(label) && !/[\u3400-\u9fff]/u.test(output)) errors.push("存在可翻译自然语言但结果没有中文");
  if (errors.length) throw new Error(`导航标题“${label}”翻译校验失败：${errors.join("、")}`);
  return output;
}
/** 单独翻译导航新增或变化的短标题。 */
async function translateNavigationLabel(label) {
  if (!/[A-Za-z]/u.test(label)) return label;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const output = await modelCompletion(`把下面的 Pi 文档导航标题忠实翻译为简体中文。API、SDK、RPC、JSON、TUI、Windows、Termux、tmux、Shell 等技术名词保持原样。只返回单行标题，不加引号或解释。\n\n${label}`, contextOptions);
    try {
      return validateNavigationTranslation(label, output);
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}
/** 验证旧英文导航与现有中文导航仍按组和路径对齐。 */
function validateOldNavigation(oldConfig, oldNavigation) {
  const translatedGroups = oldNavigation.filter((group) => !group.items?.some((item) => item.path === "changelog"));
  if (!Array.isArray(oldConfig?.navigation) || oldConfig.navigation.length !== translatedGroups.length) throw new Error("基线 docs.json 与现有中文导航分组数量不一致。" );
  oldConfig.navigation.forEach((group, groupIndex) => {
    const sourcePaths = group.items?.map((item) => item.path);
    const translatedPaths = translatedGroups[groupIndex]?.items?.map((item) => item.path);
    if (JSON.stringify(sourcePaths) !== JSON.stringify(translatedPaths)) throw new Error(`基线导航第 ${groupIndex + 1} 组与现有中文导航路径不一致。`);
  });
  return translatedGroups;
}

/** 只翻译新增或英文标题变化的导航字符串。 */
export async function buildNavigation({ oldConfig, newConfig, oldNavigation, translateLabel }) {
  const translatedGroups = validateOldNavigation(oldConfig, oldNavigation);
  if (!Array.isArray(newConfig?.navigation)) throw new Error("目标 docs.json 缺少 navigation 数组。" );
  const oldGroupTitles = new Map(oldConfig.navigation.map((group, index) => [group.title, translatedGroups[index].title]));
  const oldItems = new Map();
  oldConfig.navigation.forEach((group, groupIndex) => group.items.forEach((item, itemIndex) => {
    oldItems.set(item.path, { sourceTitle: item.title, translatedTitle: translatedGroups[groupIndex].items[itemIndex].title });
  }));
  const labelCache = new Map();
  const translateOnce = async (label) => {
    if (!labelCache.has(label)) labelCache.set(label, Promise.resolve(translateLabel(label)));
    return labelCache.get(label);
  };
  const seenPaths = new Set();
  const navigation = [];
  for (const group of newConfig.navigation) {
    if (typeof group.title !== "string" || !Array.isArray(group.items)) throw new Error("目标 docs.json 含有无效导航分组。" );
    const title = oldGroupTitles.get(group.title) ?? await translateOnce(group.title);
    const items = [];
    for (const item of group.items) {
      if (typeof item.title !== "string" || typeof item.path !== "string" || !/^([^/]+\.md)$/u.test(item.path)) throw new Error(`目标 docs.json 含有无效文档项：${JSON.stringify(item)}`);
      validateRelativePath(item.path, "导航文档路径");
      if (seenPaths.has(item.path)) throw new Error(`目标 docs.json 重复引用 ${item.path}。`);
      seenPaths.add(item.path);
      const oldItem = oldItems.get(item.path);
      items.push({ title: oldItem?.sourceTitle === item.title ? oldItem.translatedTitle : await translateOnce(item.title), path: item.path });
    }
    navigation.push({ title, items });
  }
  navigation.push({ title: "项目", items: [{ title: "中文文档变更日志", path: "changelog" }] });
  return navigation;
}

/** 为网页 JSON 数据构建唯一、可追溯的中文变更日志条目。 */
export function buildChangelogEntry({ plan, oldNavigation, newNavigation, docResults, date }) {
  const oldTitles = new Map(oldNavigation.flatMap((group) => group.items ?? []).map((item) => [item.path, item.title]));
  const newTitles = new Map(newNavigation.flatMap((group) => group.items ?? []).map((item) => [item.path, item.title]));
  const resultByPath = new Map(docResults.map((result) => [result.newPath ?? result.oldPath, result]));
  const added = [];
  const changed = [];
  const removed = [];
  for (const operation of plan.docs) {
    const detail = resultByPath.get(operation.newPath ?? operation.oldPath);
    if (operation.status === "added") added.push(`新增《${newTitles.get(operation.newPath) ?? operation.newPath}》`);
    else if (operation.status === "removed") removed.push(`移除《${oldTitles.get(operation.oldPath) ?? operation.oldPath}》`);
    else if (operation.status === "renamed") {
      changed.push(`将《${oldTitles.get(operation.oldPath) ?? operation.oldPath}》更名为《${newTitles.get(operation.newPath) ?? operation.newPath}》${detail ? `，翻译 ${detail.translatedSections} 个变化章节并复用 ${detail.reusedSections} 个章节` : ""}`);
    } else {
      changed.push(`更新《${newTitles.get(operation.newPath) ?? operation.newPath}》${detail ? `：翻译 ${detail.translatedSections} 个变化章节，复用 ${detail.reusedSections} 个未变化章节` : ""}`);
    }
  }
  for (const operation of plan.images) {
    if (operation.status === "added") added.push(`新增文档图片“${operation.newPath}”`);
    else if (operation.status === "removed") removed.push(`移除文档图片“${operation.oldPath}”`);
    else if (operation.status === "renamed") changed.push(`将文档图片“${operation.oldPath}”更名为“${operation.newPath}”`);
    else changed.push(`更新文档图片“${operation.newPath}”`);
  }
  if (plan.navigationChanged) changed.push("更新中文文档导航及上一篇/下一篇顺序");
  if (plan.versionChanged) changed.push(`官方 Pi 版本从 ${plan.currentVersion} 更新为 ${plan.targetVersion}`);
  if (plan.packageChanged && !plan.versionChanged && !added.length && !changed.length && !removed.length) changed.push(`更新官方 Pi ${plan.targetVersion} 包元数据`);
  return {
    date,
    version: plan.targetVersion,
    commit: plan.targetSha,
    summary: `从官方 Pi ${plan.currentVersion} 增量同步至 ${plan.targetVersion}（${plan.baseSha.slice(0, 7)} → ${plan.targetSha.slice(0, 7)}）。`,
    added,
    changed,
    removed,
  };
}

/** 把变更日志条目按完整提交去重后放到数组顶部。 */
export function prependChangelogEntry(changelog, entry) {
  if (!Array.isArray(changelog)) throw new Error("content/changelog.json 必须是数组。");
  if (changelog.some((item) => item.commit === entry.commit)) throw new Error(`变更日志已包含目标提交 ${entry.commit}，拒绝重复写入。`);
  return [entry, ...changelog];
}

/** 递归列出本地图片，用于 Windows 路径冲突校验。 */
async function listRelativeFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error) => error.code === "ENOENT" ? [] : Promise.reject(error));
  const output = [];
  for (const entry of entries) {
    const child = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...await listRelativeFiles(join(directory, entry.name), child));
    else if (entry.isFile()) output.push(child);
  }
  return output;
}

/** 读取文件快照；不存在用 null 表示。 */
async function readSnapshot(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

/** 判断目录是否存在。 */
async function directoryExists(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

/** 在 Windows 和 Linux 上顺序运行一个验收命令。 */
async function runCommand(command, args, cwd) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: false });
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`命令失败：${command} ${args.join(" ")}（退出码 ${code ?? "无"}${signal ? `，信号 ${signal}` : ""}）`));
    });
  });
}

/** 按项目规则执行结构、测试和两套构建验收。 */
export async function runProjectVerification(root = PROJECT_ROOT) {
  await runCommand(process.execPath, ["scripts/validate-doc-structure.mjs"], root);
  await runCommand(process.execPath, ["--test", "tests/incremental-doc-sync.test.mjs"], root);
  const npmArgs = process.env.npm_execpath
    ? [process.env.npm_execpath]
    : process.platform === "win32"
      ? [join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")]
      : null;
  if (npmArgs) {
    await runCommand(process.execPath, [...npmArgs, "run", "build:pages"], root);
    await runCommand(process.execPath, [...npmArgs, "run", "build"], root);
  } else {
    await runCommand("npm", ["run", "build:pages"], root);
    await runCommand("npm", ["run", "build"], root);
  }
  const testFiles = (await readdir(join(root, "tests")))
    .filter((file) => file.endsWith(".test.mjs") && !file.endsWith(".candidate.test.mjs"))
    .sort()
    .map((file) => join("tests", file));
  await runCommand(process.execPath, ["--test", ...testFiles], root);
}

/** 应用候选文件并执行验收；任一步失败都恢复所有受影响的源文件。 */
export async function applyStagedChanges({ writes, deletes, jsonWrites, extraRollbackPaths = [], verify = async () => {} }) {
  const writePaths = new Map();
  for (const item of [...writes, ...jsonWrites]) {
    const path = resolve(item.path);
    const key = windowsPathKey(path);
    if (writePaths.has(key)) throw new Error(`多个写入目标在 Windows 下指向同一文件：${writePaths.get(key)} 与 ${path}`);
    writePaths.set(key, path);
  }
  const deletePaths = new Map();
  for (const item of deletes) {
    const path = resolve(item);
    const key = windowsPathKey(path);
    if (writePaths.has(key)) throw new Error(`同一文件同时被写入和删除：${writePaths.get(key)} 与 ${path}`);
    if (deletePaths.has(key)) throw new Error(`多个删除目标在 Windows 下指向同一文件：${deletePaths.get(key)} 与 ${path}`);
    deletePaths.set(key, path);
  }
  const rollbackPaths = new Map();
  for (const path of [
    ...writePaths.values(),
    ...deletePaths.values(),
    ...extraRollbackPaths.map((item) => resolve(item)),
  ]) {
    const key = windowsPathKey(path);
    if (!rollbackPaths.has(key)) rollbackPaths.set(key, path);
  }
  const paths = [...rollbackPaths.values()];
  const snapshots = new Map(await Promise.all(paths.map(async (path) => [path, await readSnapshot(path)])));
  const absentDirectories = new Set();
  for (const path of paths) {
    let directory = dirname(path);
    while (directory !== dirname(directory) && !await directoryExists(directory)) {
      absentDirectories.add(directory);
      directory = dirname(directory);
    }
  }

  try {
    for (const item of writes) {
      await mkdir(dirname(item.path), { recursive: true });
      await writeFile(item.path, item.content, item.encoding);
    }
    for (const path of deletes) await rm(path, { force: true });
    for (const item of jsonWrites) {
      await mkdir(dirname(item.path), { recursive: true });
      await writeFile(item.path, `${JSON.stringify(item.value, null, 2)}\n`, "utf8");
    }
    await verify();
  } catch (error) {
    const rollbackErrors = [];
    for (const [path, content] of snapshots) {
      try {
        if (content === null) await rm(path, { force: true });
        else {
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, content);
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const directory of [...absentDirectories].sort((a, b) => b.length - a.length)) {
      try {
        await rmdir(directory);
      } catch (rollbackError) {
        if (!["ENOENT", "ENOTEMPTY", "EEXIST"].includes(rollbackError.code)) rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) throw new AggregateError([error, ...rollbackErrors], "同步失败且回滚未完整完成");
    throw error;
  }
}

/** 解析命令行参数。 */
export function parseArguments(argv) {
  const result = { plan: false, target: "main", help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--plan") result.plan = true;
    else if (argument === "--help" || argument === "-h") result.help = true;
    else if (argument === "--target") {
      const target = argv[index + 1];
      if (!target || target.startsWith("--")) throw new Error("--target 后必须提供提交 SHA 或引用。" );
      result.target = target;
      index += 1;
    } else throw new Error(`未知参数：${argument}`);
  }
  return result;
}

/** 读取提交和比较信息，生成不触发翻译的只读计划。 */
async function loadPlan({ targetRef, token, contentDir }) {
  const current = await readJson(join(contentDir, "source.json"));
  if (typeof current.commit !== "string" || typeof current.version !== "string") throw new Error("content/source.json 缺少 commit 或 version。" );
  const commit = await requestJson(`https://api.github.com/repos/${REPOSITORY}/commits/${encodeURIComponent(targetRef)}`, { token });
  if (!/^[0-9a-f]{40}$/iu.test(commit.sha)) throw new Error("GitHub 未返回完整目标提交 SHA。" );
  const targetSha = commit.sha;
  const compare = current.commit === targetSha
    ? { status: "identical", files: [], merge_base_commit: { sha: current.commit } }
    : await requestJson(`https://api.github.com/repos/${REPOSITORY}/compare/${current.commit}...${targetSha}?per_page=100`, { token });
  const packageJson = JSON.parse(await fetchPinned(targetSha, PACKAGE_PATH));
  if (typeof packageJson.version !== "string") throw new Error("目标 package.json 缺少 version。" );
  if (current.commit === targetSha && current.version !== packageJson.version) throw new Error("本地基线提交与目标相同，但版本记录不一致。" );
  return { current, plan: buildComparePlan({ baseSha: current.commit, targetSha, currentVersion: current.version, targetVersion: packageJson.version, compare }) };
}

/** 执行一次确定性的增量同步。 */
export async function runSync(argv = process.argv.slice(2), options = {}) {
  const args = parseArguments(argv);
  if (args.help) {
    console.log("用法：node scripts/sync-upstream.mjs [--plan] [--target <提交SHA或引用>]");
    return { help: true };
  }
  const root = options.root ? resolve(options.root) : PROJECT_ROOT;
  const verify = options.verify ?? (() => runProjectVerification(root));
  const generatedDocsPath = join(root, "app", "generated-docs.json");
  const contentDir = join(root, "content");
  const docsDir = join(contentDir, "docs");
  const imagesDir = join(root, "public", "docs-images");
  const token = options.token ?? process.env.GITHUB_TOKEN;
  contextOptions = { token, model: options.model ?? process.env.TRANSLATION_MODEL ?? DEFAULT_MODEL };
  const { current, plan } = await loadPlan({ targetRef: args.target, token, contentDir });
  if (args.plan) {
    console.log(JSON.stringify(plan, null, 2));
    return { plan, wrote: false };
  }
  const date = (options.now ?? new Date()).toISOString().slice(0, 10);
  const nextSource = { ...current, version: plan.targetVersion, commit: plan.targetSha, syncedAt: date, repository: REPOSITORY_URL, docsPath: `${CODING_AGENT_ROOT}/docs` };
  if (plan.unchanged) {
    await applyStagedChanges({ writes: [], deletes: [], jsonWrites: [], extraRollbackPaths: [generatedDocsPath], verify });
    console.log(`官方 Pi ${plan.targetVersion} 仍为 ${plan.targetSha.slice(0, 12)}，没有变化；已完成结构、测试和双目标构建验收。`);
    return { plan, wrote: false };
  }
  if (plan.checkpointOnly) {
    const checkpointSource = { ...current, commit: plan.targetSha, syncedAt: date };
    await applyStagedChanges({ writes: [], deletes: [], jsonWrites: [{ path: join(contentDir, "source.json"), value: checkpointSource }], extraRollbackPaths: [generatedDocsPath], verify });
    console.log(`上游只有无关代码变化，已把比较基线推进到 ${plan.targetSha.slice(0, 12)}；未调用翻译模型，也未生成日志。`);
    return { plan, wrote: true, checkpointOnly: true };
  }

  const [oldStructure, oldNavigation, changelog] = await Promise.all([
    readJson(join(contentDir, "source-structure.json")),
    readJson(join(contentDir, "navigation.json")),
    readJson(join(contentDir, "changelog.json")),
  ]);
  if (changelog.some((entry) => entry.commit === plan.targetSha)) throw new Error(`变更日志已包含目标提交 ${plan.targetSha}，但本地基线尚未推进，拒绝重复写入。`);
  const nextStructure = structuredClone(oldStructure);
  const writes = [];
  const deletes = [];
  const docResults = [];
  const sourceCache = new Map();
  const sourceText = async (sha, path) => {
    const key = `${sha}:${path}`;
    if (!sourceCache.has(key)) sourceCache.set(key, fetchPinned(sha, `${DOCS_ROOT}/${path}`));
    return sourceCache.get(key);
  };

  for (const operation of plan.docs) {
    const oldPath = operation.oldPath;
    const newPath = operation.newPath;
    let oldSource = null;
    let oldTranslation = null;
    if (oldPath) {
      if (!oldStructure[oldPath]) throw new Error(`${oldPath} 不在基线 source-structure.json 中。`);
      [oldSource, oldTranslation] = await Promise.all([
        sourceText(plan.baseSha, oldPath),
        readFile(localPath(docsDir, oldPath, "现有中文文档"), "utf8"),
      ]);
      if (sha256(oldSource) !== oldStructure[oldPath].sha256) throw new Error(`${oldPath} 的基线英文哈希与 source-structure.json 不一致。`);
    }
    if (operation.status === "removed") {
      delete nextStructure[oldPath];
      deletes.push(localPath(docsDir, oldPath, "待删除中文文档"));
      docResults.push({ ...operation, reusedSections: 0, translatedSections: 0, changedSectionTitles: [] });
      continue;
    }
    if (operation.status === "added" && oldStructure[newPath]) throw new Error(`${newPath} 被标记为新增，但基线结构中已存在。`);
    const newSource = await sourceText(plan.targetSha, newPath);
    let result;
    if (operation.status === "added") {
      const markdown = await translateMarkdown(newSource, newPath, "");
      validateTranslatedStructure(newSource, markdown, newPath, { requireSourceAnchors: false });
      result = { markdown, reusedSections: 0, translatedSections: splitMarkdownSections(newSource, newPath).filter((section) => section.raw.trim()).length, changedSectionTitles: ["新增页面"] };
    } else {
      result = await mergeIncrementalTranslation({
        oldSource,
        newSource,
        oldTranslation,
        file: newPath,
        translateSection: (markdown, file, section) => translateMarkdown(markdown, file, section),
      });
    }
    if (oldPath && oldPath !== newPath) {
      delete nextStructure[oldPath];
      deletes.push(localPath(docsDir, oldPath, "重命名旧中文文档"));
    }
    nextStructure[newPath] = { sha256: sha256(newSource), headings: analyzeMarkdown(newSource, newPath).headings };
    if (result.markdown !== oldTranslation || oldPath !== newPath) writes.push({ path: localPath(docsDir, newPath, "中文文档目标"), content: result.markdown, encoding: "utf8" });
    docResults.push({ ...operation, ...result });
  }
  assertNoWindowsPathCollisions(Object.keys(nextStructure), "中文文档结构路径");

  const existingImages = await listRelativeFiles(imagesDir);
  const nextImageSet = new Set(existingImages);
  for (const operation of plan.images) {
    if (operation.oldPath && !nextImageSet.has(operation.oldPath)) throw new Error(`基线图片不存在：${operation.oldPath}`);
    if (operation.status === "added" && nextImageSet.has(operation.newPath)) throw new Error(`新增图片目标已存在：${operation.newPath}`);
    if (operation.newPath) {
      const content = await fetchPinned(plan.targetSha, `${DOCS_ROOT}/images/${operation.newPath}`, true);
      writes.push({ path: localPath(imagesDir, operation.newPath, "文档图片目标"), content });
      nextImageSet.add(operation.newPath);
    }
    if (operation.oldPath && operation.oldPath !== operation.newPath) {
      deletes.push(localPath(imagesDir, operation.oldPath, "待删除文档图片"));
      nextImageSet.delete(operation.oldPath);
    }
  }
  assertNoWindowsPathCollisions([...nextImageSet], "文档图片路径");

  let newNavigation = oldNavigation;
  if (plan.navigationChanged) {
    const [oldConfig, newConfig] = await Promise.all([
      fetchPinned(plan.baseSha, NAVIGATION_PATH).then(JSON.parse),
      fetchPinned(plan.targetSha, NAVIGATION_PATH).then(JSON.parse),
    ]);
    newNavigation = await buildNavigation({ oldConfig, newConfig, oldNavigation, translateLabel: translateNavigationLabel });
  }
  const navigatedDocs = newNavigation.flatMap((group) => group.items ?? []).map((item) => item.path).filter((path) => path.endsWith(".md"));
  for (const path of navigatedDocs) if (!nextStructure[path]) throw new Error(`目标导航引用了不存在的文档结构：${path}`);

  const entry = buildChangelogEntry({ plan, oldNavigation, newNavigation, docResults, date });
  const jsonWrites = [];
  if (plan.navigationChanged) jsonWrites.push({ path: join(contentDir, "navigation.json"), value: newNavigation });
  jsonWrites.push(
    { path: join(contentDir, "source-structure.json"), value: nextStructure },
    { path: join(contentDir, "changelog.json"), value: prependChangelogEntry(changelog, entry) },
    { path: join(contentDir, "source.json"), value: nextSource },
  );
  await applyStagedChanges({ writes, deletes, jsonWrites, extraRollbackPaths: [generatedDocsPath], verify });
  console.log(`已增量同步 Pi ${plan.currentVersion} → ${plan.targetVersion}：处理文档 ${plan.docs.length}，图片 ${plan.images.length}，翻译章节 ${docResults.reduce((sum, item) => sum + item.translatedSections, 0)}。`);
  return { plan, wrote: true, entry, docResults };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runSync();
}
