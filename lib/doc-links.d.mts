export type DocLinkSource = {
  repository: string;
  commit: string;
  docsPath: string;
};

export type DocLinkContext = {
  pageIds: Iterable<string>;
  currentPage: string;
  source: DocLinkSource;
  siteOrigins?: Iterable<string>;
};

export type ResolvedDocLink = {
  kind: "empty" | "anchor" | "internal" | "source" | "external" | "invalid";
  href: string;
  pageId: string | null;
  hash: string;
  openInNewTab: boolean;
};

export const DEFAULT_SITE_ORIGINS: readonly string[];
export function slugifyHeading(value: string): string;
export function createHeadingSlugger(reservedIds?: Iterable<string>): (value: string) => string;
export function resolveDocHref(rawHref: string, context: DocLinkContext): ResolvedDocLink;

