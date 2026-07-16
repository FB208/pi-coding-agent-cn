import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const sourceDir = resolve(process.argv[2] || "");
const output = resolve(process.argv[3] || "content/source-structure.json");
if (!process.argv[2]) throw new Error("用法：node scripts/extract-source-structure.mjs <官方 docs 目录> [输出文件]");

/** 生成 GitHub 风格的英文标题锚点。 */
function slug(value) { return value.toLowerCase().trim().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").replace(/-+/g, "-"); }

/** 提取代码块之外的标题结构。 */
function headings(markdown) {
  const result = [];
  let fenced = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const match = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (match) result.push({ level: match[1].length, id: slug(match[2].replace(/\s+#+$/, "").replace(/[`*_]/g, "")) });
  }
  return result;
}

const files = (await readdir(sourceDir)).filter((name) => name.endsWith(".md")).sort();
const structure = {};
for (const file of files) {
  const markdown = await readFile(join(sourceDir, file), "utf8");
  structure[file] = { sha256: createHash("sha256").update(markdown).digest("hex"), headings: headings(markdown) };
}
await writeFile(output, `${JSON.stringify(structure, null, 2)}\n`, "utf8");
console.log(`已记录 ${files.length} 个官方文档的结构与哈希。`);
