import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { buildServiceWorkerScript } from "@/lib/pwa-service-worker";

/**
 * GET /sw.js — the service worker (src/lib/pwa-service-worker.ts). A route
 * rather than a file in public/ so the script carries the build id: a deploy
 * changes the bytes, the browser installs the new worker, and the old build's
 * caches are deleted on activate. `no-cache` makes the browser revalidate it
 * on every check, so that happens on the first visit after a deploy.
 */

export const dynamic = "force-dynamic";

const isDev = process.env.NODE_ENV !== "production";
const processStartedAt = Date.now().toString(36);
let cachedVersion: string | undefined;

function readCacheVersion(): string {
  if (isDev) {
    // `next dev` has no BUILD_ID; a restart is the closest thing to a deploy.
    return `dev-${processStartedAt}`;
  }

  if (cachedVersion) {
    return cachedVersion;
  }

  const buildIdPath = path.join(
    process.cwd(),
    process.env.NEXT_DIST_DIR || ".next",
    "BUILD_ID"
  );

  try {
    cachedVersion = existsSync(buildIdPath)
      ? readFileSync(buildIdPath, "utf8").trim()
      : `start-${processStartedAt}`;
  } catch {
    cachedVersion = `start-${processStartedAt}`;
  }

  return cachedVersion;
}

export function GET() {
  return new Response(buildServiceWorkerScript(readCacheVersion(), isDev), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/"
    }
  });
}
