import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  applyStagedChanges,
  assertNoWindowsPathCollisions,
  buildChangelogEntry,
  buildComparePlan,
  buildNavigation,
  mergeIncrementalTranslation,
  splitMarkdownSections,
  validateRelativePath,
  validateTranslatedStructure,
} from "../scripts/sync-upstream.mjs";

const sha = (character) => character.repeat(40);

/** 构造完整且可接受的 ahead 比较响应。 */
function comparison(base, files) {
  return { status: "ahead", merge_base_commit: { sha: base }, files };
}

test("Compare 计划只保留文档范围，并在只有无关变化时推进检查点", () => {
  const baseSha = sha("a");
  const targetSha = sha("b");
  const checkpoint = buildComparePlan({
    baseSha,
    targetSha,
    currentVersion: "1.0.0",
    targetVersion: "1.0.0",
    compare: comparison(baseSha, [{ filename: "packages/ui/src/index.ts", status: "modified" }]),
  });
  assert.equal(checkpoint.checkpointOnly, true);
  assert.equal(checkpoint.hasRelevantChanges, false);

  const plan = buildComparePlan({
    baseSha,
    targetSha,
    currentVersion: "1.0.0",
    targetVersion: "1.1.0",
    compare: comparison(baseSha, [
      { filename: "packages/ui/src/index.ts", status: "modified" },
      { filename: "packages/coding-agent/package.json", status: "modified" },
      { filename: "packages/coding-agent/docs/docs.json", status: "modified" },
      { filename: "packages/coding-agent/docs/models.md", status: "modified" },
      { filename: "packages/coding-agent/docs/images/new.png", previous_filename: "packages/coding-agent/docs/images/old.png", status: "renamed" },
    ]),
  });
  assert.equal(plan.packageChanged, true);
  assert.equal(plan.navigationChanged, true);
  assert.equal(plan.versionChanged, true);
  assert.deepEqual(plan.docs, [{ status: "modified", oldPath: "models.md", newPath: "models.md" }]);
  assert.deepEqual(plan.images, [{ status: "renamed", oldPath: "old.png", newPath: "new.png" }]);
});

test("Compare 计划拒绝不完整、分叉、未知状态和 300 文件上限", () => {
  const baseSha = sha("a");
  const common = { baseSha, targetSha: sha("b"), currentVersion: "1", targetVersion: "1" };
  assert.throws(() => buildComparePlan({ ...common, compare: { status: "diverged", files: [] } }), /只接受/);
  assert.throws(() => buildComparePlan({ ...common, compare: { status: "ahead", merge_base_commit: { sha: sha("c") }, files: [] } }), /合并基线/);
  assert.throws(() => buildComparePlan({ ...common, compare: comparison(baseSha, [{ filename: "packages/coding-agent/docs/models.md", status: "copied" }]) }), /不支持的文件状态/);
  const files = Array.from({ length: 300 }, (_, index) => ({ filename: `unrelated/${index}.txt`, status: "modified" }));
  assert.throws(() => buildComparePlan({ ...common, compare: comparison(baseSha, files) }), /300 文件上限/);
});

test("章节切分忽略代码块内标题并保留前言", () => {
  const markdown = "前言\n\n# Title\n\n```md\n## not a heading\n```\n\n## Real\nBody.\n";
  const sections = splitMarkdownSections(markdown, "fixture.md");
  assert.deepEqual(sections.map((section) => [section.level, section.title]), [[0, ""], [1, "Title"], [2, "Real"]]);
  assert.equal(sections[0].raw, "前言\n\n");
});

test("单章节变化只调用一次翻译器，其他中文章节逐字复用", async () => {
  const oldSource = "# Guide\nIntro.\n\n## Stable\nKeep this.\n\n## Changed\nOld text.\n";
  const newSource = "# Guide\nIntro.\n\n## Stable\nKeep this.\n\n## Changed\nNew text.\n";
  const oldTranslation = "# 指南\n介绍。\n\n## 稳定\n保持这段。\n\n## 已修改\n旧内容。\n";
  const calls = [];
  const result = await mergeIncrementalTranslation({
    oldSource,
    newSource,
    oldTranslation,
    file: "guide.md",
    translateSection: async (markdown, file, section) => {
      calls.push({ markdown, file, section });
      return "## 已修改\n新内容。\n";
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].section, "Changed");
  assert.equal(result.translatedSections, 1);
  assert.equal(result.reusedSections, 3);
  assert.ok(result.markdown.startsWith("# 指南\n介绍。\n\n## 稳定\n保持这段。\n\n"));
  assert.match(result.markdown, /## 已修改\n新内容。/);
});

test("未修改章节移动时复用既有中文且不调用模型", async () => {
  const oldSource = "# Guide\nIntro.\n\n## One\nFirst.\n\n## Two\nSecond.\n";
  const newSource = "# Guide\nIntro.\n\n## Two\nSecond.\n\n## One\nFirst.\n";
  const oldTranslation = "# 指南\n介绍。\n\n## 一\n第一段。\n\n## 二\n第二段。\n";
  const result = await mergeIncrementalTranslation({
    oldSource,
    newSource,
    oldTranslation,
    file: "move.md",
    translateSection: async () => { throw new Error("不应调用翻译器"); },
  });
  assert.equal(result.translatedSections, 0);
  assert.ok(result.markdown.indexOf("## 二") < result.markdown.indexOf("## 一"));
});

test("不确定章节映射和中英文标题层级不一致时失败关闭", async () => {
  const duplicateSource = "# Dup\nIntro.\n\n## Same\nText.\n\n## Same\nText.\n\n## End\nDone.\n";
  const duplicateTranslation = "# 重复\n介绍。\n\n## 相同\n译文甲。\n\n## 相同\n译文乙。\n\n## 结束\n完成。\n";
  await assert.rejects(mergeIncrementalTranslation({
    oldSource: duplicateSource,
    newSource: duplicateSource.replace("Done.", "Finished."),
    oldTranslation: duplicateTranslation,
    file: "duplicate.md",
    translateSection: async () => "## 结束\n已完成。\n",
  }), /重复章节/);

  await assert.rejects(mergeIncrementalTranslation({
    oldSource: "# A\nIntro.\n\n## B\nOld.\n",
    newSource: "# A\nIntro.\n\n## B\nNew.\n",
    oldTranslation: "# 甲\n介绍。\n\n### 乙\n旧。\n",
    file: "levels.md",
    translateSection: async () => "## 乙\n新。\n",
  }), /标题层级不一致|语义结构变化/);
});

test("结构校验保留链接、代码、列表、表格与 HTML 属性", () => {
  const source = "# Guide\n\n[Docs](https://example.com)\n\n- One\n- Two\n\n| A | B |\n|---|:--:|\n| 1 | 2 |\n\n<span data-id=\"x\">Text</span>\n\n```ts\nconst value = 1;\n```\n";
  const translated = "# 指南\n\n[文档](https://example.com)\n\n- 一\n- 二\n\n| 甲 | 乙 |\n|---|:--:|\n| 1 | 2 |\n\n<span data-id=\"x\">文字</span>\n\n```ts\nconst value = 1;\n```\n";
  assert.equal(validateTranslatedStructure(source, translated, "structure.md"), true);
  assert.throws(() => validateTranslatedStructure(source, translated.replace("https://example.com", "https://invalid.example"), "link.md"), /语义结构变化/);
  assert.throws(() => validateTranslatedStructure(source, translated.replace("data-id=\"x\"", "data-id=\"y\""), "html.md"), /语义结构变化/);
  assert.throws(() => validateTranslatedStructure(source, translated.replace("const value = 1;", "const value = 2;"), "code.md"), /语义结构变化/);
});

test("纯代码章节不强制出现中文，不支持的标题语法会明确失败", () => {
  const codeOnly = "# API\n\n```ts\nconst value = 1;\n```\n";
  assert.equal(validateTranslatedStructure(codeOnly, codeOnly, "api.md"), true);
  assert.throws(() => splitMarkdownSections("Title\n=====\n", "setext.md"), /Setext|缺少一级标题/);
  assert.throws(() => splitMarkdownSections("# Top\n\n##### Deep\n", "deep.md"), /五\/六级标题/);
});

test("导航只翻译新增或英文标题变化的字符串", async () => {
  const oldConfig = { navigation: [{ title: "Start here", items: [{ title: "Overview", path: "index.md" }, { title: "Quickstart", path: "quickstart.md" }] }] };
  const oldNavigation = [{ title: "从这里开始", items: [{ title: "概览", path: "index.md" }, { title: "快速开始", path: "quickstart.md" }] }, { title: "项目", items: [{ title: "中文文档变更日志", path: "changelog" }] }];
  const newConfig = { navigation: [{ title: "Start here", items: [{ title: "Introduction", path: "index.md" }, { title: "Quickstart", path: "quickstart.md" }, { title: "Models", path: "models.md" }] }] };
  const calls = [];
  const labels = { Introduction: "介绍", Models: "模型" };
  const navigation = await buildNavigation({
    oldConfig,
    newConfig,
    oldNavigation,
    translateLabel: async (label) => { calls.push(label); return labels[label]; },
  });
  assert.deepEqual(calls, ["Introduction", "Models"]);
  assert.deepEqual(navigation[0].items, [{ title: "介绍", path: "index.md" }, { title: "快速开始", path: "quickstart.md" }, { title: "模型", path: "models.md" }]);
  assert.equal(navigation.at(-1).items[0].path, "changelog");
});

test("变更日志包含提交范围，并用旧导航标题记录删除页", () => {
  const plan = {
    baseSha: sha("a"), targetSha: sha("b"), currentVersion: "1.0.0", targetVersion: "1.1.0",
    versionChanged: true, packageChanged: true, navigationChanged: false,
    docs: [{ status: "removed", oldPath: "old.md", newPath: null }], images: [],
  };
  const oldNavigation = [{ title: "文档", items: [{ title: "旧页面", path: "old.md" }] }];
  const entry = buildChangelogEntry({ plan, oldNavigation, newNavigation: oldNavigation, docResults: [], date: "2026-07-17" });
  assert.equal(entry.commit, sha("b"));
  assert.match(entry.summary, /1\.0\.0.*1\.1\.0.*aaaaaaa.*bbbbbbb/);
  assert.deepEqual(entry.removed, ["移除《旧页面》"]);
});

test("Windows 路径安全检查拒绝穿越、保留名和大小写冲突", () => {
  assert.equal(validateRelativePath("nested/image.png"), "nested/image.png");
  assert.throws(() => validateRelativePath("../escape.png"), /不安全/);
  assert.throws(() => validateRelativePath("CON.png"), /保留名称/);
  assert.throws(() => assertNoWindowsPathCollisions(["A.png", "a.png"]), /冲突/);
});

test("已计算的文件变化在 JSON 基线之前按顺序应用", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "pi-doc-sync-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const removed = join(directory, "removed.txt");
  const written = join(directory, "nested", "written.txt");
  const state = join(directory, "source.json");
  await writeFile(removed, "old", "utf8");
  await applyStagedChanges({
    writes: [{ path: written, content: "new", encoding: "utf8" }],
    deletes: [removed],
    jsonWrites: [{ path: state, value: { commit: sha("c") } }],
  });
  assert.equal(await readFile(written, "utf8"), "new");
  await assert.rejects(readFile(removed, "utf8"), /ENOENT/);
  assert.deepEqual(JSON.parse(await readFile(state, "utf8")), { commit: sha("c") });
});
