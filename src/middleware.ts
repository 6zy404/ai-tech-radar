import { NextRequest, NextResponse } from "next/server";

import { getPathLocale, localeRequestHeader } from "@/lib/i18n/locale";
import {
  checkWorkspaceAccess,
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

// Every path except Next's own static files: the workspace prefixes for the
// access guard, everything else for the locale header. The guard decides on
// `isProtectedWorkspacePath`, not on which matcher fired, so widening this
// list cannot open a protected prefix.
export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
