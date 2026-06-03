import { NextRequest, NextResponse } from "next/server";

import {
  checkWorkspaceAccess,
  isProtectedWorkspacePath
} from "@/lib/workspace-access";

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function unauthorizedResponse(pathname: string, status: number, message: string) {
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

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!isProtectedWorkspacePath(pathname)) {
    return NextResponse.next();
  }

  const access = checkWorkspaceAccess(request.headers);

  if (access.authorized) {
    return NextResponse.next();
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

export const config = {
  matcher: [
    "/workspace/:path*",
    "/api/workspace/:path*",
    "/api/candidates/:path*",
    "/candidates/:path*",
    "/technologies/drafts/:path*"
  ]
};
