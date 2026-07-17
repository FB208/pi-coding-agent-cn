import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const contentRoot = new URL("content/", root);
const docsRoot = new URL("docs/", contentRoot);
async function json(url) { return JSON.parse(await readFile(url, "utf8")); }

test("官方导航中的全部页面均有完整中文 Markdown", async () => {
  const navigation = await json(new URL("navigation.json", contentRoot));
  const items = navigation.flatMap((group) => group.items).filter((item) => item.path.endsWith(".md"));
  assert.ok(items.length > 0, "导航中没有文档页面");
  assert.equal(new Set(items.map((item) => item.path)).size, items.length, "导航包含重复页面");
  for (const item of items) {
    const markdown = await readFile(new URL(item.path, docsRoot), "utf8");
    assert.match(markdown, /^#\s+.+/m, `${item.path} 缺少一级标题`);
    assert.match(markdown, /[\u3400-\u9fff]/, `${item.path} 缺少中文正文`);
    assert.doesNotMatch(markdown, /�|锟斤拷/, `${item.path} 包含乱码`);
  }
});

test("所有站内文档链接与图片均指向实际资源", async () => {
  const navigation = await json(new URL("navigation.json", contentRoot));
  const paths = new Set(navigation.flatMap((group) => group.items).map((item) => item.path));
  for (const path of [...paths].filter((value) => value.endsWith(".md"))) {
    const markdown = await readFile(new URL(path, docsRoot), "utf8");
    for (const match of markdown.matchAll(/\[[^\]]*\]\((?!https?:|mailto:|#)([^/)#?]+\.md)(?:#[^)]+)?\)/g)) {
      assert.ok(paths.has(match[1].replace(/^\.\//, "")), `${path} 指向不存在的 ${match[1]}`);
    }
    for (const match of markdown.matchAll(/(?:!\[[^\]]*\]\(|<img[^>]+src=["'])(images\/[^)"']+)/g)) {
      await access(new URL(match[1].replace("images/", "public/docs-images/"), root));
    }
  }
});

test("生成数据与当前上游基线一致并包含站内变更日志", async () => {
  const [generated, source, navigation] = await Promise.all([
    json(new URL("app/generated-docs.json", root)),
    json(new URL("source.json", contentRoot)),
    json(new URL("navigation.json", contentRoot)),
  ]);
  const pageCount = navigation.flatMap((group) => group.items).filter((item) => item.path.endsWith(".md")).length;
  assert.deepEqual(generated.source, source);
  assert.equal(Object.keys(generated.docs).length, pageCount);
  assert.ok(generated.navigation.some((group) => group.items.some((item) => item.path === "changelog")));
  assert.ok(generated.changelog.length > 0);
  assert.equal(new Set(generated.changelog.map((entry) => entry.commit)).size, generated.changelog.length, "变更日志包含重复提交");
});

test("两套构建产物存在且不包含旧启动骨架", async () => {
  const [pagesHtml, workerEntry] = await Promise.all([
    readFile(new URL("dist-pages/index.html", root), "utf8"),
    readFile(new URL("dist/server/index.js", root), "utf8"),
  ]);
  assert.match(pagesHtml, /<div id="root"><\/div>/);
  assert.doesNotMatch(pagesHtml + workerEntry, /codex-preview|SkeletonPreview/);
});
