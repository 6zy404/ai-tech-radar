import type { Metadata } from "next";
import type { ReactNode } from "react";

import { TopNav } from "@/components/top-nav";
import { getSiteUrl, siteDescription, siteName } from "@/lib/site-metadata";
import { themeStorageKey } from "@/lib/theme";

import "./globals.css";

// Every page's own title goes through the template; `metadataBase` is what
// turns the relative canonical and Open Graph URLs the pages declare into
// absolute ones. Pages set their own title and description with
// `buildPageMetadata` (src/lib/site-metadata.ts).
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: siteName, template: `%s · ${siteName}` },
  description: siteDescription,
  openGraph: {
    siteName,
    locale: "zh_CN",
    type: "website",
    title: siteName,
    description: siteDescription
  }
};

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `suppressHydrationWarning` is required here, not cosmetic: the script
    // below sets `data-theme` and `color-scheme` on this element before React
    // hydrates, so the client attributes legitimately differ from the server
    // HTML. Without it React logs a hydration mismatch on every page load. It
    // suppresses the warning for this element's attributes only — children are
    // still checked normally.
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <TopNav />
        <main className="main-content">{children}</main>
      </body>
    </html>
  );
}
