/**
 * The two interface languages of the public site.
 *
 * Chinese is the site's own language and keeps every address it ever had;
 * English lives under `/en`, one route file per public page in
 * `src/app/en/`. Nothing here reads a request, so both the middleware (edge
 * runtime) and client components can import it.
 *
 * The workspace, the feeds and the API routes have no English version, so
 * none of them has an `/en` address.
 */

export type Locale = "zh" | "en";

export const locales: readonly Locale[] = ["zh", "en"];

export const defaultLocale: Locale = "zh";

export const englishPathPrefix = "/en";

/**
 * Set by `src/middleware.ts` on every request, overwriting whatever the
 * client sent, so the root layout can write `<html lang>` — a root layout
 * cannot see the pathname any other way.
 */
export const localeRequestHeader = "x-site-locale";

/** The `lang` attribute for each interface language. */
export const documentLangs: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en"
};

/** The `hreflang` value each version is announced under. */
export const hreflangs: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en"
};

/** Open Graph's locale code (`og:locale`). */
export const openGraphLocales: Record<Locale, string> = {
  zh: "zh_CN",
  en: "en_US"
};

export function isLocale(value: unknown): value is Locale {
  return value === "zh" || value === "en";
}

/** Which interface language a pathname belongs to. */
export function getPathLocale(pathname: string): Locale {
  return pathname === englishPathPrefix ||
    pathname.startsWith(`${englishPathPrefix}/`)
    ? "en"
    : "zh";
}

/** `/en/technologies` → `/technologies`, `/en` → `/`; others unchanged. */
export function stripLocalePrefix(pathname: string): string {
  if (pathname === englishPathPrefix) {
    return "/";
  }

  return pathname.startsWith(`${englishPathPrefix}/`)
    ? pathname.slice(englishPathPrefix.length)
    : pathname;
}

/**
 * The address of a site path in one interface language. `path` is a
 * Chinese-site path starting with `/`, optionally with a query or fragment:
 * `localePath("en", "/")` is `/en`, `localePath("en", "/?a=1")` is `/en?a=1`,
 * `localePath("zh", path)` is `path` itself.
 */
export function localePath(locale: Locale, path: string): string {
  if (locale === "zh") {
    return path;
  }

  if (!path.startsWith("/")) {
    return path;
  }

  if (path === "/" || path.startsWith("/?") || path.startsWith("/#")) {
    return `${englishPathPrefix}${path.slice(1)}`;
  }

  return `${englishPathPrefix}${path}`;
}

/** Both versions of a Chinese-site path, keyed by locale. */
export function getLocaleAlternates(path: string): Record<Locale, string> {
  return { zh: localePath("zh", path), en: localePath("en", path) };
}

/**
 * Chinese-site path prefixes with no English twin: the workspace and its
 * legacy redirects, the feeds and API routes, and the offline fallback page.
 * Everything else under the public site has one.
 */
const untranslatedPrefixes = [
  "/workspace",
  "/candidates",
  "/technologies/drafts",
  "/api",
  "/offline",
  "/feed.xml",
  "/feed.json"
];

/** Whether a Chinese-site path has an English twin (and so a switch). */
export function hasEnglishTwin(path: string): boolean {
  const pathname = path.split(/[?#]/)[0];

  return !(
    untranslatedPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    ) || pathname.endsWith(".xml")
  );
}
