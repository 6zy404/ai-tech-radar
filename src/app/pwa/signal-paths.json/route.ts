import { NextResponse } from "next/server";

import { getAllTechnologies } from "@/lib/content";

/**
 * GET /pwa/signal-paths.json — published signal id → page path, for the
 * service worker's offline copy of 稍后读. 稍后读 stores ids in the reader's
 * browser; the worker needs paths to fetch. Serving the whole map, the same
 * for everyone, lets it resolve the reader's ids itself, so the server never
 * learns which signals were saved. Published signals only, and nothing but
 * the id and the public path.
 */

export const dynamic = "force-dynamic";

export function GET() {
  const paths: Record<string, string> = {};

  for (const technology of getAllTechnologies()) {
    paths[technology.id] = `/technologies/${technology.slug}`;
  }

  return NextResponse.json(
    { paths },
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}
