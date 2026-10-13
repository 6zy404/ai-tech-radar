import { NextResponse } from "next/server";

import { getAllTechnologies } from "@/lib/content";
import { buildSignalPathMap } from "@/lib/pwa-signal-paths";

/**
 * GET /pwa/signal-paths.json — published signal key → page path, for the
 * service worker's offline copy of 稍后读. 稍后读 lives in the reader's
 * browser; the worker needs paths to fetch. Serving the whole map, the same
 * for everyone, lets it resolve the reader's saved signals itself, so the
 * server never learns which were saved. Keys are hashed ids
 * (src/lib/pwa-signal-paths.ts).
 */

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { paths: buildSignalPathMap(getAllTechnologies()) },
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}
