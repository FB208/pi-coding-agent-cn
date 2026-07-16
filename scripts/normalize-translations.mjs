import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const navigation = JSON.parse(await readFile(join(root, "content", "navigation.json"), "utf8"));
const items = navigation.flatMap((group) => group.items).filter((item) => item.path.endsWith(".md"));

/** 清除非原文声明并统一一级标题。 */
function normalize(markdown, title) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const cleaned = lines.filter((line) => {
    if (line.includes("本页面是 [Pi 官方文档") && line.includes("中文翻译")) return false;
    if (line.includes("法律声明") && line.includes("pi.dev 官方文档")) return false;
    return true;
  });
  const heading = cleaned.findIndex((line) => /^#\s+/.test(line));
  if (heading >= 0) cleaned[heading] = `# ${title}`;
  const content = cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim().replace(/\n---\s*$/, "").trim();
  return `${content}\n`;
}

for (const item of items) {
  const path = join(root, "content", "docs", item.path);
  const before = await readFile(path, "utf8");
  const after = normalize(before, item.title);
  if (before !== after) await writeFile(path, after, "utf8");
}
console.log(`已规范化 ${items.length} 个中文页面。`);
