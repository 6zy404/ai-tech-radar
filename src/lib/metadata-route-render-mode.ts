/**
 * Which generated metadata routes (share images, icons, the sitemap) must say
 * in their source whether they are rendered per request.
 *
 * `next build` prerenders a metadata route that has nothing request-dependent
 * in it and serves that file forever. For a route that reads the content store
 * that means a card frozen on the build day: `/digest/today/opengraph-image`
 * shipped that way until 2026-09-30, because the deployment check only looked
 * at `page.tsx`.
 *
 * A route under a dynamic segment (`[slug]`) is exempt unless it exports
 * `generateStaticParams`: with no params known at build time there is nothing
 * to prerender, and the live build confirms it — on 2026-09-30 its prerender
 * manifest listed no dynamic routes and `.next/server/app` held no cached
 * output for any of the seven such share images after a night of traffic.
 *
 * Pure functions over file paths and sources, so the rule is testable without
 * a file system; `scripts/validate-deployment.ts` feeds it `src/app`.
 */

export interface RouteSourceFile {
  /** Path relative to the repository root, with forward slashes. */
  path: string;
  source: string;
}

// `robots` is left out on purpose: it holds no content, so prerendering it is
// correct. `icon` and `apple-icon` may be numbered (icon1.tsx).
const generatedMetadataRoutePattern =
  /^(opengraph-image|twitter-image|icon\d*|apple-icon\d*|sitemap|manifest)\.(tsx|ts|jsx|js)$/;

const dynamicDeclarationPattern = /export\s+const\s+dynamic\s*=/;
const staticParamsPattern =
  /export\s+(async\s+function|function|const|let)\s+generateStaticParams\b/;

function segmentsOf(filePath: string): string[] {
  return filePath.split("/").filter(Boolean);
}

export function isGeneratedMetadataRoute(filePath: string): boolean {
  const segments = segmentsOf(filePath);
  const basename = segments[segments.length - 1] ?? "";
  return generatedMetadataRoutePattern.test(basename);
}

/** `[slug]`, `[...slug]` and `[[...slug]]`; route groups and slots are not. */
export function hasDynamicSegment(filePath: string): boolean {
  return segmentsOf(filePath)
    .slice(0, -1)
    .some((segment) => /^\[.+\]$/.test(segment));
}

/**
 * Matches `export const dynamic = …` and nothing else — a plain substring
 * test would also accept `export const dynamicParams`.
 */
export function declaresRenderMode(source: string): boolean {
  return dynamicDeclarationPattern.test(source);
}

export function mustDeclareRenderMode(file: RouteSourceFile): boolean {
  if (!isGeneratedMetadataRoute(file.path)) {
    return false;
  }

  return !hasDynamicSegment(file.path) || staticParamsPattern.test(file.source);
}

/** Paths of the metadata routes that `next build` could freeze. */
export function findUndeclaredMetadataRoutes(
  files: readonly RouteSourceFile[]
): string[] {
  return files
    .filter(
      (file) => mustDeclareRenderMode(file) && !declaresRenderMode(file.source)
    )
    .map((file) => file.path)
    .sort();
}
