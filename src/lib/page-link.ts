// 复制链接 on the public detail pages: which address goes on the clipboard.
// Pure functions only — the components (`copy-link-button.tsx`,
// `section-link.tsx`) do the clipboard and the address bar.

/**
 * The page's canonical address: the site URL (`getSiteUrl`, the same source
 * as `metadataBase` and every page's `<link rel="canonical">`) joined to the
 * page's own path, never the address the reader happens to be on — which can
 * carry a query, a hash, or be `/digest/today` standing in for a dated issue.
 * With `sectionId`, the address of that section.
 */
export function buildPageLinkUrl(
  siteUrl: string,
  path: string,
  sectionId?: string
): string {
  const base = siteUrl.replace(/\/+$/, "");
  const cleanPath = `/${path.split(/[?#]/)[0].replace(/^\/+/, "")}`;
  const hash = sectionId ? `#${encodeURIComponent(sectionId)}` : "";

  return `${base}${cleanPath}${hash}`;
}

/** What a screen reader calls a section's 「#」 link. */
export function getSectionLinkLabel(heading: string): string {
  return `复制「${heading.trim()}」一节的链接`;
}
