import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const token = process.env.GITHUB_TOKEN;
const model = process.env.TRANSLATION_MODEL || "openai/gpt-4.1";
const rawRoot = "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent";
if (!token) throw new Error("缺少 GitHub Actions 自动提供的 GITHUB_TOKEN。");

/** 调用 GitHub API，且绝不输出令牌。 */
async function githubJson(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2026-03-10", ...(init.headers || {}) } });
  if (!response.ok) throw new Error(`${url} 请求失败：${response.status} ${await response.text()}`);
  return response.json();
}

async function upstreamText(path) {
  const response = await fetch(`${rawRoot}/${path}`);
  if (!response.ok) throw new Error(`读取上游 ${path} 失败：${response.status}`);
  return response.text();
}
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const slug = (value) => value.toLowerCase().trim().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").replace(/-+/g, "-");

/** 提取标题、链接和不可翻译代码，用于强校验。 */
function analyze(markdown) {
  const headings = [], links = [], inline = [], blocks = [];
  let fence = "", block = [];
  for (const line of markdown.split(/\r?\n/)) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1] ?? "";
    if (marker) {
      if (!fence) { fence = marker[0]; block = [line]; }
      else { block.push(line); blocks.push(block.join("\n")); fence = ""; block = []; }
      continue;
    }
    if (fence) { block.push(line); continue; }
    const heading = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (heading) headings.push({ level: heading[1].length, id: slug(heading[2].replace(/\s+#+$/, "").replace(/[`*_]/g, "")) });
    for (const match of line.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) links.push(match[1]);
    for (const match of line.matchAll(/`([^`\n]+)`/g)) inline.push(match[1]);
  }
  return { headings, links, inline, blocks, unclosedFence: Boolean(fence) };
}

/** 仅在代码块之外按空行切分长文档。 */
function splitMarkdown(markdown, limit = 18000) {
  const result = [];
  let current = [], length = 0, fence = "";
  for (const line of markdown.split(/\r?\n/)) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1] ?? "";
    if (!fence && !line && length >= limit) { result.push(current.join("\n")); current = []; length = 0; continue; }
    current.push(line); length += line.length + 1;
    if (marker) fence = fence ? "" : marker[0];
  }
  if (current.length) result.push(current.join("\n"));
  return result;
}

/** 拒绝结构、链接或代码发生变化的翻译。 */
function validate(source, translated, file) {
  const a = analyze(source), b = analyze(translated), errors = [];
  if (b.unclosedFence) errors.push("代码围栏未闭合");
  if (JSON.stringify(a.headings.map((item) => item.level)) !== JSON.stringify(b.headings.map((item) => item.level))) errors.push("标题层级变化");
  if (JSON.stringify(a.links) !== JSON.stringify(b.links)) errors.push("链接目标变化");
  if (JSON.stringify(a.inline) !== JSON.stringify(b.inline)) errors.push("行内代码变化");
  if (JSON.stringify(a.blocks) !== JSON.stringify(b.blocks)) errors.push("围栏代码块变化");
  if (!/[\u3400-\u9fff]/.test(translated)) errors.push("没有中文正文");
  if (errors.length) throw new Error(`${file} 翻译校验失败：${errors.join("、")}`);
}

/** 使用 GitHub Actions 自带身份调用 GitHub Models。 */
async function translateChunk(text, file, index, total) {
  const content = `逐句忠实翻译下面的 Pi Coding Agent Markdown 为简体中文，不摘要、不删节、不补充。严格保持 Markdown/HTML 结构、标题级别、链接目标、图片路径、围栏代码块和行内代码原样；只翻译自然语言、标题及链接文字。API、类型、变量、命令保持英文。这是 ${file} 的第 ${index + 1}/${total} 段。只返回 Markdown。\n\n${text}`;
  const response = await githubJson("https://models.github.ai/inference/chat/completions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, temperature: 0.1, messages: [{ role: "user", content }] }) });
  return response.choices?.[0]?.message?.content?.trimEnd() ?? "";
}

async function translate(markdown, file) {
  const parts = splitMarkdown(markdown);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const output = [];
    for (let index = 0; index < parts.length; index += 1) output.push(await translateChunk(parts[index], file, index, parts.length));
    const result = `${output.join("\n\n").trim()}\n`;
    try { validate(markdown, result, file); return result; }
    catch (error) { if (attempt === 2) throw error; }
  }
}

const contentDir = join(root, "content"), docsDir = join(contentDir, "docs");
const readJson = (name) => readFile(join(contentDir, name), "utf8").then(JSON.parse);
const [current, oldStructure, oldNavigation, changelog, commit, pkg, config] = await Promise.all([
  readJson("source.json"), readJson("source-structure.json"), readJson("navigation.json"), readJson("changelog.json"),
  githubJson("https://api.github.com/repos/earendil-works/pi/commits/main"), upstreamText("package.json").then(JSON.parse), upstreamText("docs/docs.json").then(JSON.parse),
]);
const items = config.navigation.flatMap((group) => group.items);
const files = items.map((item) => item.path).filter((path) => path.endsWith(".md"));
const sources = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await upstreamText(`docs/${file}`)])));
const structure = Object.fromEntries(files.map((file) => [file, { sha256: sha256(sources[file]), headings: analyze(sources[file]).headings }]));
const added = files.filter((file) => !oldStructure[file]);
const changed = files.filter((file) => oldStructure[file] && oldStructure[file].sha256 !== structure[file].sha256);
const removed = Object.keys(oldStructure).filter((file) => !structure[file]);
if (!added.length && !changed.length && !removed.length && current.version === pkg.version) {
  console.log(`官方文档仍为 Pi ${pkg.version}，没有变化。`); process.exit(0);
}

await mkdir(docsDir, { recursive: true });
for (const file of [...added, ...changed]) { console.log(`正在翻译 ${file}…`); await writeFile(join(docsDir, file), await translate(sources[file], file), "utf8"); }
for (const file of removed) await rm(join(docsDir, file), { force: true });
const groupTitles = { "Start here": "从这里开始", Customization: "自定义", Reference: "参考", "Programmatic Usage": "编程式使用", "Platform Setup": "平台设置", Development: "开发" };
const knownTitles = new Map(oldNavigation.flatMap((group) => group.items).map((item) => [item.path, item.title]));
const navigation = config.navigation.map((group) => ({ title: groupTitles[group.title] || group.title, items: group.items.map((item) => ({ title: knownTitles.get(item.path) || item.title, path: item.path })) }));
navigation.push({ title: "项目", items: [{ title: "中文文档变更日志", path: "changelog" }] });
const date = new Date().toISOString().slice(0, 10);
const title = (file) => navigation.flatMap((group) => group.items).find((item) => item.path === file)?.title || file;
changelog.unshift({ date, version: pkg.version, commit: commit.sha, summary: `同步官方 Pi ${pkg.version} 文档。`, added: added.map((file) => `新增《${title(file)}》`), changed: changed.map((file) => `更新《${title(file)}》`), removed: removed.map((file) => `移除《${title(file)}》`) });
await Promise.all([
  writeFile(join(contentDir, "navigation.json"), `${JSON.stringify(navigation, null, 2)}\n`, "utf8"),
  writeFile(join(contentDir, "source-structure.json"), `${JSON.stringify(structure, null, 2)}\n`, "utf8"),
  writeFile(join(contentDir, "changelog.json"), `${JSON.stringify(changelog, null, 2)}\n`, "utf8"),
  writeFile(join(contentDir, "source.json"), `${JSON.stringify({ version: pkg.version, commit: commit.sha, syncedAt: date, repository: "https://github.com/earendil-works/pi", docsPath: "packages/coding-agent/docs" }, null, 2)}\n`, "utf8"),
]);
console.log(`已同步 Pi ${pkg.version}：新增 ${added.length}，更新 ${changed.length}，移除 ${removed.length}。`);
