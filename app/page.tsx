"use client";

import { isValidElement, useEffect, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { resolveDocHref, slugifyHeading } from "../lib/doc-links.mjs";
import generated from "./generated-docs.json";

type Doc = (typeof generated.docs)[keyof typeof generated.docs];

/** 提取 React 子节点中的纯文本。 */
function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

/** 将地址栏锚点滚动到当前文档中的真实元素。 */
function scrollToHash(hash: string) {
  if (!hash) { scrollTo({ top: 0, behavior: "smooth" }); return; }
  let id = hash.replace(/^#/, "");
  try { id = decodeURIComponent(id); } catch {}
  document.getElementById(id)?.scrollIntoView();
}

/** 带复制按钮的代码块。 */
function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = nodeText(children).replace(/\n$/, "");
  return <div className="codeBlock"><div><span>代码</span><button onClick={async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }}>{copied ? "已复制" : "复制"}</button></div><pre>{children}</pre></div>;
}

/** 中文文档变更日志页面。 */
function Changelog() {
  return <article className="changelog"><h1>中文文档变更日志</h1><p className="lead">记录中文文档基线、上游版本以及每次同步带来的页面变化。</p>{generated.changelog.map((entry) => <section key={`${entry.date}-${entry.version}`}>
    <div className="releaseHead"><div><time>{entry.date}</time><h2>Pi {entry.version}</h2></div><code>{entry.commit.slice(0, 8)}</code></div>
    <p>{entry.summary}</p>
    {(["added", "changed", "removed"] as const).map((kind) => entry[kind].length ? <div className={`changeGroup ${kind}`} key={kind}><strong>{{ added: "新增", changed: "调整", removed: "移除" }[kind]}</strong><ul>{entry[kind].map((item) => <li key={item}>{item}</li>)}</ul></div> : null)}
  </section>)}</article>;
}

const orderedIds = generated.navigation.flatMap((group) => group.items).filter((item) => item.path.endsWith(".md")).map((item) => item.path.replace(/\.md$/, ""));
const pageIds = new Set(Object.keys(generated.docs));

export default function Home() {
  const [page, setPage] = useState("index");
  const [dark, setDark] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  /** 从地址栏恢复页面，并兼容旧版 overview 链接。 */
  useEffect(() => {
    const readLocation = () => {
      const requested = new URLSearchParams(location.search).get("page") || "index";
      setPage(requested === "overview" ? "index" : requested);
    };
    readLocation();
    const themeFrame = requestAnimationFrame(() => setDark(localStorage.getItem("pi-theme") === "dark"));
    addEventListener("popstate", readLocation);
    return () => { cancelAnimationFrame(themeFrame); removeEventListener("popstate", readLocation); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("pi-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "Escape") setSearchOpen(false);
    };
    addEventListener("keydown", handleKey);
    return () => removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!location.hash) return;
    const frame = requestAnimationFrame(() => scrollToHash(location.hash));
    return () => cancelAnimationFrame(frame);
  }, [page]);

  const go = (id: string, hash = "") => {
    const safeId = id in generated.docs || id === "changelog" ? id : "index";
    setPage(safeId);
    setMenuOpen(false);
    setSearchOpen(false);
    const target = safeId === "index" ? location.pathname : `${location.pathname}?page=${encodeURIComponent(safeId)}`;
    history.pushState({}, "", `${target}${hash}`);
    requestAnimationFrame(() => scrollToHash(hash));
  };

  const current = page in generated.docs ? generated.docs[page as keyof typeof generated.docs] as Doc : null;
  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return Object.entries(generated.docs).slice(0, 10);
    return Object.entries(generated.docs).filter(([, doc]) => `${doc.title}\n${doc.description}\n${doc.markdown}`.toLowerCase().includes(needle)).slice(0, 12);
  }, [query]);

  const headingIds = current?.headingIds as Record<string, string> | undefined;
  const headingId = (line: number | undefined, children: ReactNode) => line ? (headingIds?.[String(line)] ?? slugifyHeading(nodeText(children))) : slugifyHeading(nodeText(children));
  const components: Components = {
    h1: ({ children, node }) => { const id = headingId(node?.position?.start.line, children); return <h1 id={id}>{children}</h1>; },
    h2: ({ children, node }) => { const id = headingId(node?.position?.start.line, children); return <h2 id={id}><a href={`#${id}`}>{children}<em>#</em></a></h2>; },
    h3: ({ children, node }) => { const id = headingId(node?.position?.start.line, children); return <h3 id={id}><a href={`#${id}`}>{children}<em>#</em></a></h3>; },
    h4: ({ children, node }) => { const id = headingId(node?.position?.start.line, children); return <h4 id={id}><a href={`#${id}`}>{children}<em>#</em></a></h4>; },
    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
    a: ({ href, children, node, ...props }) => {
      void node;
      const resolved = resolveDocHref(href ?? "", {
        pageIds,
        currentPage: current?.path.replace(/\.md$/, "") ?? "index",
        source: generated.source,
      });
      if (resolved.kind === "empty") return <a {...props}>{children}</a>;
      if (resolved.kind === "invalid") return <span>{children}</span>;
      if (resolved.kind === "internal" && resolved.pageId) {
        return <a {...props} href={resolved.href} onClick={(event) => { event.preventDefault(); go(resolved.pageId!, resolved.hash); }}>{children}</a>;
      }
      return <a {...props} href={resolved.href} target={resolved.openInNewTab ? "_blank" : undefined} rel={resolved.openInNewTab ? "noreferrer" : undefined}>{children}</a>;
    },
    img: ({ src = "", alt = "", ...props }) => <img {...props} src={src.startsWith("images/") ? `./docs-images/${src.slice(7)}` : src} alt={alt} loading="lazy" />,
  };

  const currentIndex = current ? orderedIds.indexOf(current.path.replace(/\.md$/, "")) : -1;
  const previous = currentIndex > 0 ? generated.docs[orderedIds[currentIndex - 1] as keyof typeof generated.docs] : null;
  const next = currentIndex >= 0 && currentIndex < orderedIds.length - 1 ? generated.docs[orderedIds[currentIndex + 1] as keyof typeof generated.docs] : null;

  return <div>
    <header className="topbar"><button className="mobile" aria-label="打开菜单" onClick={() => setMenuOpen(!menuOpen)}>☰</button><button className="brand" onClick={() => go("index")}><i>π</i>Pi</button><nav><a href="https://pi.dev">首页</a><button onClick={() => go("index")}>文档</button><button className={page === "changelog" ? "active" : ""} onClick={() => go("changelog")}>中文文档变更日志</button></nav><div className="actions"><button className="searchButton" onClick={() => setSearchOpen(true)}><span>搜索文档</span><kbd>Ctrl K</kbd></button><a href={generated.source.repository} target="_blank" rel="noreferrer" aria-label="GitHub">↗</a><button onClick={() => setDark(!dark)} aria-label="切换主题">{dark ? "☾" : "☼"}</button></div></header>
    <aside className={`sidebar ${menuOpen ? "open" : ""}`}><strong>中文文档</strong>{generated.navigation.map((group) => <div className="navGroup" key={group.title}><label>{group.title}</label>{group.items.map((item) => { const id = item.path.replace(/\.md$/, ""); return <button className={page === id ? "selected" : ""} key={item.path} onClick={() => go(id)}>{item.title}</button>; })}</div>)}</aside>
    <main><div className="eyebrow">官方文档中文翻译 <b>·</b> Pi {generated.source.version} <span>· {generated.source.commit.slice(0, 8)}</span></div>{page === "changelog" ? <Changelog /> : current ? <><article className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>{current.markdown}</ReactMarkdown></article><nav className="pager" aria-label="文档翻页"><div>{previous && <button onClick={() => go(previous.path.replace(/\.md$/, ""))}><small>← 上一篇</small><strong>{previous.title}</strong></button>}</div><div>{next && <button onClick={() => go(next.path.replace(/\.md$/, ""))}><small>下一篇 →</small><strong>{next.title}</strong></button>}</div></nav></> : <article><h1>未找到文档</h1><p>请求的页面不存在。</p></article>}<footer>非官方简体中文翻译 · 源文档版本 Pi {generated.source.version} · <a href={`${generated.source.repository}/tree/${generated.source.commit}/${generated.source.docsPath}`} target="_blank" rel="noreferrer">查看官方原文</a></footer></main>
    {current && <aside className="toc"><strong>本页目录</strong>{current.headings.filter((heading) => heading.level <= 3).map((heading, index) => <a className={`level-${heading.level}`} href={`#${heading.id}`} key={`${heading.id}-${index}`}>{heading.title}</a>)}</aside>}
    {searchOpen && <div className="overlay" onMouseDown={() => setSearchOpen(false)}><div className="searchPanel" onMouseDown={(event) => event.stopPropagation()}><div className="searchInput"><b>⌕</b><input autoFocus placeholder="搜索全部中文文档……" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>ESC</kbd></div><div className="results">{searchResults.map(([id, doc]) => <button key={id} onClick={() => go(id)}><span><strong>{doc.title}</strong><small>{doc.description}</small></span><i>↵</i></button>)}{!searchResults.length && <p>没有找到相关文档</p>}</div></div></div>}
    {menuOpen && <button className="backdrop" aria-label="关闭菜单" onClick={() => setMenuOpen(false)} />}
  </div>;
}

