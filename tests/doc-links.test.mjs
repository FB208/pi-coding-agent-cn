import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createHeadingSlugger, resolveDocHref } from "../lib/doc-links.mjs";
import { validateDocLinks } from "../scripts/validate-doc-links.mjs";

const root = new URL("../", import.meta.url);
const source = JSON.parse(await readFile(new URL("content/source.json", root), "utf8"));
const navigation = JSON.parse(await readFile(new URL("content/navigation.json", root), "utf8"));
const documentedPageIds = navigation.flatMap((group) => group.items).filter((item) => item.path.endsWith(".md")).map((item) => item.path.replace(/\.md$/, ""));
const context = {
  pageIds: new Set(["index", "quickstart", "usage", "tui"]),
  currentPage: "index",
  source,
};

test("所有常见站内地址均转换为查询式中文文档路由", () => {
  const cases = new Map([
    ["quickstart.md", "?page=quickstart"],
    ["./quickstart.md#安装", "?page=quickstart#安装"],
    ["quickstart.mdx", "?page=quickstart"],
    ["/docs/latest/tui", "?page=tui"],
    ["https://pi.dev/docs/latest/usage", "?page=usage"],
    ["https://pi-coding-agent-cn.yanghuichao.chatgpt.site/quickstart.md", "?page=quickstart"],
    ["?page=quickstart#安装", "?page=quickstart#安装"],
  ]);
  for (const [input, expected] of cases) assert.equal(resolveDocHref(input, context).href, expected, input);
});

test("用户报告的复合错误地址可恢复到正确中文页面", () => {
  const input = "https://pi-coding-agent-cn.yanghuichao.chatgpt.site/[quickstart](https://pi-coding-agent-cn.yanghuichao.chatgpt.site/quickstart.md).md";
  assert.deepEqual(resolveDocHref(input, context), {
    kind: "internal",
    href: "?page=quickstart",
    pageId: "quickstart",
    hash: "",
    openInNewTab: false,
  });
});

test("相对源码链接固定到当前上游提交", () => {
  assert.equal(
    resolveDocHref("../examples/sdk/02-custom-model.ts", context).href,
    `${source.repository}/blob/${source.commit}/packages/coding-agent/examples/sdk/02-custom-model.ts`,
  );
  assert.equal(
    resolveDocHref("../examples/sdk/", context).href,
    `${source.repository}/tree/${source.commit}/packages/coding-agent/examples/sdk`,
  );
});

test("标题锚点保留下划线并为重复标题编号", () => {
  const slug = createHeadingSlugger();
  assert.equal(slug("set_steering_mode"), "set_steering_mode");
  assert.equal(slug("重复标题"), "重复标题");
  assert.equal(slug("重复标题"), "重复标题-1");
});

test("生成后的全部文档链接与锚点通过校验", async () => {
  const report = await validateDocLinks();
  assert.equal(report.pages, documentedPageIds.length);
  assert.equal(report.links, Object.values(report.counts).reduce((sum, count) => sum + count, 0));
  assert.deepEqual(Object.keys(report.counts).sort(), ["anchor", "external", "internal", "source"]);
});

