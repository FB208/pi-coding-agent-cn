/** Pi 中文文档在两套托管环境中的公开地址。 */
export const DEFAULT_SITE_ORIGINS = Object.freeze([
  "https://pi-coding-agent-cn.yanghuichao.chatgpt.site",
  "https://yanghuichao.github.io/pi-coding-agent-cn",
]);

/** 生成与页面渲染共用的 GitHub 风格标题锚点。 */
export function slugifyHeading(value) {
  return String(value)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[`*~]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** 为重复标题追加递增后缀，并避开已有 HTML 锚点。 */
export function createHeadingSlugger(reservedIds = []) {
  const seen = new Set(reservedIds);
  return (value) => {
    const base = slugifyHeading(value);
    let id = base;
    let suffix = 0;
    while (seen.has(id)) id = `${base}-${++suffix}`;
    seen.add(id);
    return id;
  };
}

/** 安全解码仅用于识别被编码的错误链接形态。 */
function safeDecode(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

/** 从错误地嵌入 URL 的 Markdown 语法中取回真正目标。 */
function recoverNestedMarkdownUrl(value) {
  for (const candidate of [value, safeDecode(value)]) {
    const match = /\[[^\]\r\n]*\]\((https?:\/\/[^)\s]+|[^)\r\n]+)\)(?:\.mdx?)?/i.exec(candidate);
    if (match?.[1] && match[1] !== value) return match[1].trim();
  }
  return value;
}

/** 规范化仓库内路径，阻止 `..` 逃出仓库根目录。 */
function normalizeRepositoryPath(value) {
  const parts = [];
  for (const part of value.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { parts.pop(); continue; }
    parts.push(part);
  }
  return parts.join("/");
}

/** 保留 GitHub 路径分隔符，只编码各级文件名。 */
function encodeRepositoryPath(value) {
  return value.split("/").map((part) => encodeURIComponent(part)).join("/");
}

/** 将目标拆分为路径、查询参数和锚点。 */
function splitTarget(value) {
  const hashIndex = value.indexOf("#");
  const hash = hashIndex >= 0 ? value.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const queryIndex = withoutHash.indexOf("?");
  return {
    path: queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash,
    query: queryIndex >= 0 ? withoutHash.slice(queryIndex) : "",
    hash,
  };
}

/** 从文档文件名或文档路由中提取已知页面标识。 */
function pageIdFromPath(path, pageIds) {
  const clean = safeDecode(path).replace(/\\/g, "/").replace(/\/+$/, "");
  const last = clean.split("/").pop() ?? "";
  const id = last.replace(/\.(?:md|mdx|html?)$/i, "");
  return pageIds.has(id) ? id : null;
}

/** 生成站内查询式路由，保证 GitHub Pages 与 Sites 行为一致。 */
function internalResult(pageId, hash = "") {
  const normalizedHash = hash && hash !== "#" ? (hash.startsWith("#") ? hash : `#${hash}`) : "";
  return {
    kind: "internal",
    href: `?page=${encodeURIComponent(pageId)}${normalizedHash}`,
    pageId,
    hash: normalizedHash,
    openInNewTab: false,
  };
}

/** 判断绝对 URL 是否属于已知中文站点。 */
function siteHosts(origins) {
  const hosts = new Set();
  for (const origin of origins) {
    try { hosts.add(new URL(origin).host); } catch {}
  }
  return hosts;
}

/** 尝试把绝对地址映射回中文文档页面。 */
function internalFromAbsoluteUrl(url, pageIds, context) {
  const requested = url.searchParams.get("page");
  if (requested && pageIds.has(requested)) return internalResult(requested, url.hash);

  const knownSiteHosts = siteHosts(context.siteOrigins ?? DEFAULT_SITE_ORIGINS);
  if (knownSiteHosts.has(url.host)) {
    const pageId = pageIdFromPath(url.pathname, pageIds);
    if (pageId) return internalResult(pageId, url.hash);
  }

  if (url.hostname === "pi.dev") {
    const match = /^\/docs\/(?:latest\/)?([^/?#]+)/i.exec(url.pathname);
    const pageId = match ? pageIdFromPath(match[1], pageIds) : null;
    if (pageId) return internalResult(pageId, url.hash);
  }

  if (url.hostname === "github.com" && url.pathname.includes("/packages/coding-agent/docs/")) {
    const pageId = pageIdFromPath(url.pathname, pageIds);
    if (pageId) return internalResult(pageId, url.hash);
  }

  return null;
}

/** 把非文档相对地址固定到当前上游提交，避免本站产生不存在的子路径。 */
function sourceResult(path, query, hash, context) {
  const source = context.source;
  const repository = source.repository.replace(/\/$/, "");
  const repositoryPath = normalizeRepositoryPath(`${source.docsPath}/${path}`);
  const route = path.endsWith("/") || !/\.[^/]+$/.test(path) ? "tree" : "blob";
  return {
    kind: "source",
    href: `${repository}/${route}/${source.commit}/${encodeRepositoryPath(repositoryPath)}${query}${hash}`,
    pageId: null,
    hash: "",
    openInNewTab: true,
  };
}

/**
 * 统一解析正文中的所有链接目标。
 *
 * @param {string} rawHref Markdown 提供的原始目标。
 * @param {{pageIds: Iterable<string>, currentPage: string, source: {repository: string, commit: string, docsPath: string}, siteOrigins?: Iterable<string>}} context
 */
export function resolveDocHref(rawHref, context) {
  const pageIds = context.pageIds instanceof Set ? context.pageIds : new Set(context.pageIds);
  const original = String(rawHref ?? "").trim();
  if (!original) return { kind: "empty", href: "", pageId: null, hash: "", openInNewTab: false };

  const href = recoverNestedMarkdownUrl(original);
  if (href.startsWith("#")) return { kind: "anchor", href, pageId: context.currentPage, hash: href, openInNewTab: false };

  if (href.startsWith("?")) {
    const { query, hash } = splitTarget(href);
    const requested = new URLSearchParams(query.slice(1)).get("page");
    if (requested && pageIds.has(requested)) return internalResult(requested, hash);
  }

  if (href.startsWith("//")) {
    const url = new URL(`https:${href}`);
    const internal = internalFromAbsoluteUrl(url, pageIds, context);
    if (internal) return internal;
    return { kind: "external", href, pageId: null, hash: "", openInNewTab: true };
  }

  if (/^https?:/i.test(href)) {
    try {
      const url = new URL(href);
      const internal = internalFromAbsoluteUrl(url, pageIds, context);
      if (internal) return internal;
      return { kind: "external", href: url.href, pageId: null, hash: "", openInNewTab: true };
    } catch {
      return { kind: "invalid", href: "", pageId: null, hash: "", openInNewTab: false };
    }
  }

  if (/^(?:mailto|tel):/i.test(href)) {
    return { kind: "external", href, pageId: null, hash: "", openInNewTab: false };
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) {
    return { kind: "invalid", href: "", pageId: null, hash: "", openInNewTab: false };
  }

  const { path, query, hash } = splitTarget(href);
  const docsRoute = /^\/?docs\/(?:latest\/)?([^/?#]+)/i.exec(path);
  const docsRoutePage = docsRoute ? pageIdFromPath(docsRoute[1], pageIds) : null;
  if (docsRoutePage) return internalResult(docsRoutePage, hash);

  const pageId = pageIdFromPath(path, pageIds);
  if (pageId && (/\.(?:md|mdx|html?)$/i.test(path) || !path.includes("."))) return internalResult(pageId, hash);

  if (path.startsWith("/")) {
    return { kind: "external", href: `https://pi.dev${path}${query}${hash}`, pageId: null, hash: "", openInNewTab: true };
  }

  return sourceResult(path || `${context.currentPage}.md`, query, hash, context);
}

