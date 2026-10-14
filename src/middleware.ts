import { NextRequest, NextResponse } from "next/server";

import { getPathLocale, localeRequestHeader } from "@/lib/i18n/locale";
import {
  checkWorkspaceAccess,
  checkWorkspaceRequestSource,
  isProtectedWorkspacePath
} from "@/lib/workspace-access";

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function unauthorizedResponse(
  pathname: string,
  status: number,
  message: string
) {
  if (isApiPath(pathname)) {
    return NextResponse.json({ error: message }, { status });
  }

  return new NextResponse(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "WWW-Authenticate": 'Basic realm="AI Tech Radar Workspace"'
    }
  });
}

/**
 * Passes the request on with the interface language in a request header, so
 * the root layout can write `<html lang>`. The header is always overwritten:
 * a value the client sent never reaches the page.
 */
function continueWithLocale(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(localeRequestHeader, getPathLocale(request.nextUrl.pathname));

  return NextResponse.next({ request: { headers } });
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!isProtectedWorkspacePath(pathname)) {
    return continueWithLocale(request);
  }

  // Before the token: a cross-site write must fail even when the guard is off
  // (an editorial round) or the browser would attach cached credentials.
  const source = checkWorkspaceRequestSource(request.headers, request.method);

  if (!source.ok) {
    return unauthorizedResponse(pathname, 403, source.reason);
  }

  const access = checkWorkspaceAccess(request.headers);

  if (access.authorized) {
    return continueWithLocale(request);
  }

  if (access.enabled && !access.configured) {
    return unauthorizedResponse(
      pathname,
      503,
      "Workspace access protection is enabled, but WORKSPACE_ACCESS_TOKEN is not configured."
    );
  }

  return unauthorizedResponse(
    pathname,
    401,
    access.reason ?? "Workspace access token is required."
  );
}

// The five protected prefixes are listed on their own, so nothing in the last
// entry can ever exclude one — `/workspace/x.json` still reaches the guard.
// The last entry adds the locale header for every page; it skips Next's own
// assets, the other API routes and files with an extension (icons, sw.js, the
// manifest, the feeds), none of which renders the layout. The guard decides
// on `isProtectedWorkspacePath`, not on which entry matched.
// `validate:deployment` checks both halves against Next's own matcher.
export const config = {
  matcher: [
    "/workspace/:path*",
    "/api/workspace/:path*",
    "/api/candidates/:path*",
    "/candidates/:path*",
    "/technologies/drafts/:path*",
    "/((?!_next/|api/|icons/|.*\\.(?:ico|png|svg|js|json|xml|txt|webmanifest)$).*)"
  ]
};
