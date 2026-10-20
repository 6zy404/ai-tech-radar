import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies
} from "@/lib/content";
import { getLatestPublishedDailyDigest } from "@/lib/digest-workflow";
import { getSemanticSearchStatus } from "@/lib/hybrid-search";
import { getPublicNewsItems } from "@/lib/news";

/**
 * GET /api/health — what an external uptime check polls.
 *
 * Public and unauthenticated, so it says only what a reader could infer from
 * the site anyway: that the stores read, how many signals are published, how
 * many items the news lane shows, the date of the latest digest, the size of
 * the skill and knowledge pools, whether the embedding model is loaded, which
 * build is running, and how long the process has been up. No paths, no env,
 * no provider names.
 *
 * The store check reads what the home page reads (since 2026-10-21): the
 * published signals, the news lane (the candidate snapshot — the largest
 * store, rewritten on every import), the latest published digest, and the
 * skill and knowledge pools. Until then it read the signals alone, so a
 * damaged candidate or digest file would have 500ed the home page while this
 * route kept answering `ok`. Every read is memoized with the pages, so the
 * check costs nothing extra and warms the same caches.
 *
 * `status` is `ok` when every store reads; a search model that is still
 * loading or failed is reported but does not flip the status, because the
 * site keeps answering from keywords in that state. `503` only when a store
 * cannot be read — the case that means the site is serving errors.
 */

export const dynamic = "force-dynamic";

const startedAt = Date.now();

/** The home page's reads, by the store each exercises. Public numbers only. */
const storeReads = {
  signals: () => getAllTechnologies().length,
  news: () => getPublicNewsItems().length,
  digest: () => getLatestPublishedDailyDigest()?.date ?? null,
  skills: () => getAllSkills().length,
  knowledge: () => getAllKnowledge().length
};

type StoreReadName = keyof typeof storeReads;

interface StoreCheckOk {
  ok: true;
  publishedSignals: number;
  newsItems: number;
  latestDigest: string | null;
  skills: number;
  knowledge: number;
}

interface StoreCheckFailed {
  ok: false;
  /** Which reads threw, by name — never the error text, which names a path. */
  failed: StoreReadName[];
}

function checkStores(): StoreCheckOk | StoreCheckFailed {
  const failed: StoreReadName[] = [];
  const results: Partial<Record<StoreReadName, number | string | null>> = {};

  for (const name of Object.keys(storeReads) as StoreReadName[]) {
    try {
      results[name] = storeReads[name]();
    } catch {
      failed.push(name);
    }
  }

  if (failed.length > 0) {
    return { ok: false, failed };
  }

  return {
    ok: true,
    publishedSignals: results.signals as number,
    newsItems: results.news as number,
    latestDigest: results.digest as string | null,
    skills: results.skills as number,
    knowledge: results.knowledge as number
  };
}

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
  const store = checkStores();
  const search = getSemanticSearchStatus();

  return NextResponse.json(
    {
      status: store.ok ? "ok" : "degraded",
      checkedAt,
      build: readBuildId(),
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      checks: {
        store,
        search: {
          model: search.model.state,
          modelSince: search.model.since,
          corpus: search.corpus
        }
      }
    },
    {
      status: store.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
