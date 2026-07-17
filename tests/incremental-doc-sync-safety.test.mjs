import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  addSourceHeadingAnchors,
  analyzeMarkdown,
  applyStagedChanges,
  buildComparePlan,
  prependChangelogEntry,
  validateLegacyTranslation,
  validateNavigationTranslation,
  validateTranslatedStructure,
} from "../scripts/sync-upstream.mjs";

const sha = (character) => character.repeat(40);

/** 构造可接受的线性 Compare 响应。 */
function comparison(base, files) {
  return { status: "ahead", merge_base_commit: { sha: base }, files };
}

test("完全相同的提交不会生成写入计划", () => {
  const commit = sha("a");
  const plan = buildComparePlan({
    baseSha: commit,
    targetSha: commit,
    currentVersion: "1.0.0",
    targetVersion: "1.0.0",
    compare: { status: "identical", files: [] },
  });
  assert.equal(plan.unchanged, true);
  assert.equal(plan.checkpointOnly, false);
  assert.deepEqual(plan.docs, []);
  assert.deepEqual(plan.images, []);
});

test("Compare 计划覆盖文档与图片的新增、删除和重命名", () => {
  const baseSha = sha("a");
  const plan = buildComparePlan({
    baseSha,
    targetSha: sha("b"),
    currentVersion: "1.0.0",
    targetVersion: "1.0.0",
    compare: comparison(baseSha, [
      { filename: "packages/coding-agent/docs/new.md", status: "added" },
      { filename: "packages/coding-agent/docs/removed.md", status: "removed" },
      { filename: "packages/coding-agent/docs/renamed.md", previous_filename: "packages/coding-agent/docs/old.md", status: "renamed" },
      { filename: "packages/coding-agent/docs/images/new.png", status: "added" },
      { filename: "packages/coding-agent/docs/images/removed.png", status: "removed" },
    ]),
  });
  assert.deepEqual(plan.docs, [
    { status: "added", oldPath: null, newPath: "new.md" },
    { status: "removed", oldPath: "removed.md", newPath: null },
    { status: "renamed", oldPath: "old.md", newPath: "renamed.md" },
  ]);
  assert.deepEqual(plan.images, [
    { status: "added", oldPath: null, newPath: "new.png" },
    { status: "removed", oldPath: "removed.png", newPath: null },
  ]);
});

test("仅大小写或 Unicode 形式变化的重命名在 Windows 上失败关闭", () => {
  const baseSha = sha("a");
  assert.throws(() => buildComparePlan({
    baseSha,
    targetSha: sha("b"),
    currentVersion: "1.0.0",
    targetVersion: "1.0.0",
    compare: comparison(baseSha, [{
      filename: "packages/coding-agent/docs/Guide.md",
      previous_filename: "packages/coding-agent/docs/guide.md",
      status: "renamed",
    }]),
  }), /仅大小写或 Unicode/u);
});

test("官方标题锚点保留下划线并为重复标题追加后缀", () => {
  const source = "# Set_steering_mode\n\n## Repeat\nOne.\n\n## Repeat\nTwo.\n";
  const translated = "# Set_steering_mode 设置\n\n## 重复\n一。\n\n## 重复\n二。\n";
  const anchored = addSourceHeadingAnchors(source, translated, "anchors.md");
  assert.match(anchored, /^<a id="set_steering_mode"><\/a>/u);
  assert.match(anchored, /<a id="repeat"><\/a>\n## 重复/u);
  assert.match(anchored, /<a id="repeat-1"><\/a>\n## 重复/u);
  assert.equal(validateTranslatedStructure(source, anchored, "anchors.md", { requireSourceAnchors: true }), true);
  assert.deepEqual(analyzeMarkdown(source, "anchors.md").headings.map((heading) => heading.id), ["set_steering_mode", "repeat", "repeat-1"]);
});

test("现有中文基线允许历史链接与代码排布差异，但拒绝章节层级错位", () => {
  const source = "# Guide\n\nUse `value` and [Docs](https://example.com).\n\n## Next\nDone.\n";
  const legacy = "# 指南\n\n查看[旧链接](https://legacy.example)，并使用 value。\n\n<a id=\"legacy-next\"></a>\n## 下一步\n完成。\n";
  assert.equal(validateLegacyTranslation(source, legacy, "legacy.md"), true);
  assert.throws(() => validateLegacyTranslation(source, legacy.replace("## 下一步", "### 下一步"), "legacy.md"), /标题层级/u);
});

test("短自然语言需要翻译，技术字面量和示例值不得变化", () => {
  assert.throws(() => validateTranslatedStructure("# Run\n\nSet it up.\n", "# Run\n\nSet it up.\n", "short.md"), /没有中文/u);

  const source = "# Options\n\nUse deferredToolsMode with true, API 1.2.3, count 3, model openai/gpt-5-mini, and --plan.\n";
  const translated = "# 选项\n\n使用 deferredToolsMode、true、API 1.2.3、count 3、model openai/gpt-5-mini 和 --plan。\n";
  assert.equal(validateTranslatedStructure(source, translated, "tokens.md"), true);
  assert.throws(() => validateTranslatedStructure(source, translated.replace("deferredToolsMode", "延迟工具模式"), "camel.md"), /技术字面量/u);
  assert.throws(() => validateTranslatedStructure(source, translated.replace("true", "false"), "boolean.md"), /技术字面量/u);
  assert.throws(() => validateTranslatedStructure(source, translated.replace("--plan", "--apply"), "flag.md"), /技术字面量/u);
  assert.throws(() => validateTranslatedStructure(source, translated.replace("count 3", "count 5"), "integer.md"), /技术字面量/u);
  assert.throws(() => validateTranslatedStructure(source, translated.replace("openai/gpt-5-mini", "aliyun/qwen-max"), "model-id.md"), /技术字面量/u);

  const htmlSource = "# HTML\n\n<p>Run it with deferredToolsMode and true.</p>\n";
  assert.throws(() => validateTranslatedStructure(htmlSource, htmlSource, "html-untranslated.md"), /没有中文/u);
  const htmlTranslated = "# HTML\n\n<p>使用 deferredToolsMode 和 true 运行。</p>\n";
  assert.equal(validateTranslatedStructure(htmlSource, htmlTranslated, "html-token.md"), true);
  assert.throws(() => validateTranslatedStructure(htmlSource, htmlTranslated.replace("deferredToolsMode", "延迟工具模式"), "html-token-invalid.md"), /技术字面量/u);
});

test("导航翻译拒绝原样英文并保留技术名词", () => {
  assert.throws(() => validateNavigationTranslation("Quickstart", "Quickstart"), /没有中文/u);
  assert.equal(validateNavigationTranslation("API Reference", "API 参考"), "API 参考");
  assert.throws(() => validateNavigationTranslation("API Reference", "接口参考"), /技术字面量/u);
  assert.equal(validateNavigationTranslation("OpenAI", "OpenAI"), "OpenAI");
});

test("变更日志按完整提交去重，同版本不同提交仍可记录", () => {
  const first = { date: "2026-07-17", version: "1.0.0", commit: sha("a") };
  const second = { date: "2026-07-17", version: "1.0.0", commit: sha("b") };
  assert.deepEqual(prependChangelogEntry([first], second), [second, first]);
  assert.throws(() => prependChangelogEntry([first], { ...second, commit: first.commit }), /重复写入/u);
});

test("事务层按 Windows 路径键拒绝同文件写删冲突", async () => {
  const directory = join(tmpdir(), "pi-doc-case-conflict");
  await assert.rejects(applyStagedChanges({
    writes: [{ path: join(directory, "Guide.md"), content: "new", encoding: "utf8" }],
    deletes: [join(directory, "guide.md")],
    jsonWrites: [],
  }), /同时被写入和删除/u);
});

test("图片按二进制写入，不发生文本转码", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "pi-doc-binary-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "image.bin");
  const bytes = Buffer.from([0, 255, 13, 10, 128, 1]);
  await applyStagedChanges({ writes: [{ path, content: bytes }], deletes: [], jsonWrites: [] });
  assert.deepEqual(await readFile(path), bytes);
});

test("验收失败时恢复修改、删除、JSON、构建产物和新增目录", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "pi-doc-rollback-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const existing = join(directory, "existing.md");
  const removed = join(directory, "removed.png");
  const sourceJson = join(directory, "content", "source.json");
  const generated = join(directory, "app", "generated-docs.json");
  const added = join(directory, "new", "nested", "added.md");
  await Promise.all([
    mkdir(join(directory, "content"), { recursive: true }),
    mkdir(join(directory, "app"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(existing, "旧正文", "utf8"),
    writeFile(removed, Buffer.from([1, 2, 3])),
    writeFile(sourceJson, "{\"commit\":\"old\"}\n", "utf8"),
    writeFile(generated, "旧构建产物", "utf8"),
  ]);

  await assert.rejects(applyStagedChanges({
    writes: [
      { path: existing, content: "新正文", encoding: "utf8" },
      { path: added, content: "新增正文", encoding: "utf8" },
    ],
    deletes: [removed],
    jsonWrites: [{ path: sourceJson, value: { commit: "new" } }],
    extraRollbackPaths: [generated],
    verify: async () => {
      assert.equal(await readFile(existing, "utf8"), "新正文");
      await writeFile(generated, "新构建产物", "utf8");
      throw new Error("模拟验收失败");
    },
  }), /模拟验收失败/u);

  assert.equal(await readFile(existing, "utf8"), "旧正文");
  assert.deepEqual(await readFile(removed), Buffer.from([1, 2, 3]));
  assert.equal(await readFile(sourceJson, "utf8"), "{\"commit\":\"old\"}\n");
  assert.equal(await readFile(generated, "utf8"), "旧构建产物");
  await assert.rejects(readFile(added), /ENOENT/u);
});
