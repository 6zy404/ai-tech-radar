import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { getAllTechnologies } from "@/lib/content";
import { getSemanticSearchStatus } from "@/lib/hybrid-search";

/**
 * GET /api/health — what an external uptime check polls.
 *
 * Public and unauthenticated, so it says only what a reader could infer from
 * the site anyway: that the store reads, how many signals are published,
 * whether the embedding model is loaded, which build is running, and how long
 * the process has been up. No paths, no env, no provider names.
 *
 * `status` is `ok` when the store reads; a search model that is still loading
 * or failed is reported but does not flip the status, because the site keeps
 * answering from keywords in that state. `503` only when the store itself
 * cannot be read — the case that means the site is serving nothing useful.
 */

export const dynamic = "force-dynamic";

const startedAt = Date.now();

function readBuildId(): string {
  const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");

  try {
    return existsSync(buildIdPath)
      ? readFileSync(buildIdPath, "utf8").trim()
      : "dev";
  } catch {
    return "unknown";
  }
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  let publishedSignals: number | undefined;
  let storeError: string | undefined;

  try {
    publishedSignals = getAllTechnologies().length;
  } catch (error) {
    storeError = error instanceof Error ? error.name : "error";
  }

  const search = getSemanticSearchStatus();
  const ok = storeError === undefined;

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      checkedAt,
      build: readBuildId(),
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      checks: {
        store: ok ? { ok: true, publishedSignals } : { ok: false },
        search: {
          model: search.model.state,
          modelSince: search.model.since,
          corpus: search.corpus
        }
      }
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
