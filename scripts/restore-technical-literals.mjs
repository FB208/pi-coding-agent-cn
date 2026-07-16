import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const sourceDir = resolve(process.argv[2] || "");
const translatedDir = resolve(process.argv[3] || "content/docs");
if (!process.argv[2]) throw new Error("用法：node scripts/restore-technical-literals.mjs <官方 docs 目录> [中文目录]");

/** 提取并替换围栏代码块，保证示例代码与官方原文逐字一致。 */
function restoreBlocks(source, translated, file) {
  const pattern = /(^|\n)(\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\s*\3)(?=\n|$)/g;
  const blocks = [...source.matchAll(pattern)].map((match) => match[2]);
  let index = 0;
  const output = translated.replace(pattern, (full, prefix) => `${prefix}${blocks[index++] ?? full.slice(prefix.length)}`);
  if (index !== blocks.length) throw new Error(`${file} 的代码块数量不一致（官方 ${blocks.length}，中文 ${index}）`);
  return output;
}

const files = (await readdir(sourceDir)).filter((name) => name.endsWith(".md")).sort();
for (const file of files) {
  const source = await readFile(join(sourceDir, file), "utf8");
  const path = join(translatedDir, file);
  const translated = await readFile(path, "utf8");
  const restored = restoreBlocks(source, translated, file);
  if (restored !== translated) await writeFile(path, `${restored.trimEnd()}\n`, "utf8");
}
console.log(`已按官方原文逐字恢复 ${files.length} 个页面的围栏代码块。`);
