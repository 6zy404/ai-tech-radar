import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ErrorShellRepair } from "@/components/error-shell-repair";
import { PwaRegistration } from "@/components/pwa-registration";
import { SkipLink } from "@/components/skip-link";
import { TopNav } from "@/components/top-nav";
import { documentLangs, openGraphLocales } from "@/lib/i18n/locale";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import {
  buildFeedAlternateTypes,
  getSiteUrl,
  siteDescriptions,
  siteName
} from "@/lib/site-metadata";
import { mainContentId } from "@/lib/skip-link-targets";
import { themeStorageKey } from "@/lib/theme";

import "./globals.css";

// Every page's own title goes through the template; `metadataBase` is what
// turns the relative canonical and Open Graph URLs the pages declare into
// absolute ones. Pages set their own title and description with
// `buildPageMetadata` (src/lib/site-metadata.ts).
// Read per request because the English site (/en) shares this layout.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();

  return {
    metadataBase: new URL(getSiteUrl()),
    title: { default: siteName, template: `%s · ${siteName}` },
    description: siteDescriptions[locale],
    // For pages with no metadata of their own (the not-found page);
    // `buildPageMetadata` repeats these for every other page.
    alternates: { types: buildFeedAlternateTypes([], locale) },
    openGraph: {
      siteName,
      locale: openGraphLocales[locale],
      type: "website",
      title: siteName,
      description: siteDescriptions[locale]
    }
  };
}

/**
 * Resolves the colour scheme before first paint.
 *
 * The stylesheet keys dark mode off `:root[data-theme="dark"]`, and the server
 * cannot know which scheme this reader wants — the same HTML is served to
 * everyone. Setting the attribute from a `<head>` script means the first paint
 * is already correct; doing it in an effect would flash light first.
 *
 * The storage key is imported rather than retyped, so this string and
 * `src/lib/theme.ts` cannot drift apart.
 *
 * It fails silently on purpose: if storage or matchMedia throws (private
 * windows do), the page renders light rather than not at all.
 */
const themeBootstrapScript = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  themeStorageKey
)});var t=(s==="light"||s==="dark")?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=t;}catch(e){}})();`;

export default async function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  // `zh-CN`, or `en` under /en, from the header src/middleware.ts sets.
  // Also handed to ErrorShellRepair, which restores it on Next's error shell.
  const documentLang = documentLangs[await getRequestLocale()];

  return (
    // `suppressHydrationWarning` is required here, not cosmetic: the script
    // below sets `data-theme` and `color-scheme` on this element before React
    // hydrates, so the client attributes legitimately differ from the server
    // HTML. Without it React logs a hydration mismatch on every page load. It
    // suppresses the warning for this element's attributes only — children are
    // still checked normally.
    <html lang={documentLang} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <ErrorShellRepair lang={documentLang} />
        {/* The manifest link comes from src/app/manifest.ts on its own. */}
        <PwaRegistration />
        <SkipLink />
        <TopNav />
        <main id={mainContentId} className="main-content" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  );
}
