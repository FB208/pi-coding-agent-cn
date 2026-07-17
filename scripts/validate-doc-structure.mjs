import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const structure = JSON.parse(await readFile(join(root, "content", "source-structure.json"), "utf8"));
let failed = false;

/** 提取代码块之外的标题级别与代码围栏数量。 */
function analyze(markdown) {
  const levels = [];
  let marker = "";
  let fences = 0;
  for (const line of markdown.split(/\r?\n/)) {
    const fence = /^\s*(`{3,}|~{3,})/.exec(line)?.[1] ?? "";
    if (fence) {
      fences += 1;
      if (!marker) marker = fence[0];
      else if (fence[0] === marker) marker = "";
      continue;
    }
    if (marker) continue;
    const heading = /^(#{1,4})\s+/.exec(line);
    if (heading) levels.push(heading[1].length);
  }
  return { levels, fences };
}

for (const [file, source] of Object.entries(structure)) {
  const markdown = await readFile(join(root, "content", "docs", file), "utf8");
  const translated = analyze(markdown);
  const expected = source.headings.map((heading) => heading.level);
  if (JSON.stringify(translated.levels) !== JSON.stringify(expected)) {
    failed = true;
    console.error(`${file}: 标题结构不一致（官方 ${expected.length}，中文 ${translated.levels.length}）`);
  }
  if (translated.fences % 2 !== 0) {
    failed = true;
    console.error(`${file}: 代码围栏未闭合`);
  }
}
if (failed) process.exitCode = 1;
else console.log(`${Object.keys(structure).length} 个中文页面的标题结构与官方源文档一致。`);
