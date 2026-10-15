import Link from "next/link";

import { rssFeedPath } from "@/lib/feed-paths";
import { footerCopy } from "@/lib/i18n/copy/footer";
import { hasEnglishTwin, localePath, type Locale } from "@/lib/i18n/locale";

/** Where readers report a problem or get in touch: the repository's issues. */
export const siteFeedbackUrl = "https://github.com/6zy404/ai-tech-radar/issues";

type FooterLabelKey = "about" | "privacy" | "sources" | "rss";

export interface SiteFooterLink {
  key: FooterLabelKey;
  href: string;
  label: string;
  /** A feed, not a page: a plain link, announced as RSS. */
  feed: boolean;
}

// Chinese-site paths. A path with an English twin takes /en on the English
// site; the feed has none (every feed is in Chinese), so it keeps its path.
const footerPaths: { key: FooterLabelKey; path: string; feed?: true }[] = [
  { key: "about", path: "/about" },
  { key: "privacy", path: "/about#privacy" },
  { key: "sources", path: "/sources" },
  { key: "rss", path: rssFeedPath, feed: true }
];

/** The footer's internal links, in order, for one interface language. */
export function getSiteFooterLinks(locale: Locale): SiteFooterLink[] {
  const copy = footerCopy[locale];

  return footerPaths.map(({ key, path, feed }) => ({
    key,
    href: hasEnglishTwin(path) ? localePath(locale, path) : path,
    label: copy[key],
    feed: feed ?? false
  }));
}

/**
 * The footer under every public page, rendered once by the root layout after
 * `<main>`: how signals are picked, the privacy section, the publisher
 * directory, the briefing feed and where to send feedback, then one sentence
 * on how AI-written and unedited content is labelled.
 *
 * A server component with no state: the locale comes from the layout, which
 * reads it from the request like `<html lang>`. The layout persists across
 * client navigation, so the footer can be in the wrong language exactly when
 * `<html lang>` is — which is why the nav's language link is a full load.
 *
 * Workspace pages render the same layout; there the footer is hidden by CSS
 * (`site-footer.css`), keyed on the workspace shell inside `<main>`, which
 * also holds when a client navigation enters the workspace from a public
 * page — a server-side check here would not re-run then.
 */
export function SiteFooter({ locale }: { locale: Locale }) {
  const copy = footerCopy[locale];

  return (
    <footer className="site-footer">
      <nav className="site-footer__nav" aria-label={copy.navLabel}>
        <ul className="site-footer__links">
          {getSiteFooterLinks(locale).map((link) => (
            <li key={link.key}>
              {link.feed ? (
                <a href={link.href} type="application/rss+xml">
                  {link.label}
                </a>
              ) : (
                <Link href={link.href}>{link.label}</Link>
              )}
            </li>
          ))}
          <li>
            {copy.contactLabel}
            <a href={siteFeedbackUrl} target="_blank" rel="noreferrer noopener">
              {copy.contactLink}
            </a>
          </li>
        </ul>
      </nav>
      <p className="site-footer__note">{copy.note}</p>
    </footer>
  );
}
