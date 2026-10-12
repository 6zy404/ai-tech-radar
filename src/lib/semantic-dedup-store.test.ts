import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EMBEDDING_MODEL } from "@/lib/embeddings";
import {
  SEMANTIC_DEDUP_RULES,
  SEMANTIC_DEDUP_RULE_VERSION
} from "@/lib/semantic-dedup";
import {
  SEMANTIC_MATCH_STORE_FILE,
  getSemanticCandidatePairs,
  getSemanticPublishedMatches,
  mergeSemanticMatchStore,
  type SemanticDedupRunSummary,
  type SemanticMatchStore
} from "@/lib/semantic-dedup-store";

const run: SemanticDedupRunSummary = {
  startedAt: "2026-10-13T00:05:00.000Z",
  finishedAt: "2026-10-13T00:05:03.000Z",
  durationMs: 3000,
  status: "success",
  candidateCount: 3,
  candidatePairCount: 1,
  publishedMatchCount: 1,
  message: ""
};

const provenance = (threshold: number, computedAt = run.finishedAt) => ({
  model: EMBEDDING_MODEL,
  ruleVersion: SEMANTIC_DEDUP_RULE_VERSION,
  threshold,
  computedAt
});

function storeWith(
  partial: Partial<SemanticMatchStore> = {}
): SemanticMatchStore {
  return {
    updatedAt: "",
    candidatePairs: [],
    publishedMatches: {},
    ...partial
  };
}

describe("mergeSemanticMatchStore", () => {
  it("replaces what the run covered and keeps what it did not see", () => {
    const previous = storeWith({
      candidatePairs: [
        // Covered by this run: replaced.
        {
          leftId: "a",
          rightId: "b",
          score: 0.97,
          ...provenance(SEMANTIC_DEDUP_RULES.candidateThreshold)
        },
        // Written by another process from a newer snapshot: kept.
        {
          leftId: "x",
          rightId: "y",
          score: 0.98,
          ...provenance(SEMANTIC_DEDUP_RULES.candidateThreshold)
        }
      ],
      publishedMatches: {
        a: {
          candidateId: "a",
          technologyId: "old",
          technologyTitle: "Old",
          score: 0.93,
          ...provenance(SEMANTIC_DEDUP_RULES.publishedThreshold)
        },
        x: {
          candidateId: "x",
          technologyId: "tech-x",
          technologyTitle: "X",
          score: 0.93,
          ...provenance(SEMANTIC_DEDUP_RULES.publishedThreshold)
        }
      }
    });

    const merged = mergeSemanticMatchStore(previous, {
      coveredCandidateIds: ["a", "b", "c"],
      candidatePairs: [{ leftId: "b", rightId: "c", score: 0.965 }],
      publishedMatches: [],
      run
    });

    expect(
      merged.candidatePairs.map((pair) => `${pair.leftId}-${pair.rightId}`)
    ).toEqual(["x-y", "b-c"]);
    expect(Object.keys(merged.publishedMatches)).toEqual(["x"]);
    expect(merged.lastRun).toEqual(run);
    expect(merged.candidatePairs[1]).toMatchObject(
      provenance(SEMANTIC_DEDUP_RULES.candidateThreshold)
    );
  });

  it("drops entries older than the retention window", () => {
    const merged = mergeSemanticMatchStore(
      storeWith({
        candidatePairs: [
          {
            leftId: "x",
            rightId: "y",
            score: 0.98,
            ...provenance(
              SEMANTIC_DEDUP_RULES.candidateThreshold,
              "2026-08-01T00:00:00.000Z"
            )
          }
        ]
      }),
      { coveredCandidateIds: [], candidatePairs: [], publishedMatches: [], run }
    );

    expect(merged.candidatePairs).toEqual([]);
  });
});

describe("reading the store", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(tmpdir(), "semantic-matches-"));
    previousDataDir = process.env.LOCAL_DATA_DIR;
    process.env.LOCAL_DATA_DIR = dataDir;
  });

  afterEach(() => {
    if (previousDataDir === undefined) {
      delete process.env.LOCAL_DATA_DIR;
    } else {
      process.env.LOCAL_DATA_DIR = previousDataDir;
    }

    rmSync(dataDir, { recursive: true, force: true });
  });

  it("treats a match made under another model, rule version or threshold as absent", () => {
    const current = provenance(SEMANTIC_DEDUP_RULES.candidateThreshold);

    writeFileSync(
      path.join(dataDir, SEMANTIC_MATCH_STORE_FILE),
      JSON.stringify(
        storeWith({
          candidatePairs: [
            { leftId: "a", rightId: "b", score: 0.97, ...current },
            {
              leftId: "c",
              rightId: "d",
              score: 0.97,
              ...current,
              model: "some/other-model"
            },
            {
              leftId: "e",
              rightId: "f",
              score: 0.97,
              ...current,
              ruleVersion: "semantic-dedup-v0"
            },
            {
              leftId: "g",
              rightId: "h",
              score: 0.95,
              ...current,
              threshold: 0.95
            }
          ],
          publishedMatches: {
            a: {
              candidateId: "a",
              technologyId: "tech-a",
              technologyTitle: "A",
              score: 0.93,
              ...provenance(SEMANTIC_DEDUP_RULES.publishedThreshold)
            },
            c: {
              candidateId: "c",
              technologyId: "tech-c",
              technologyTitle: "C",
              score: 0.93,
              ...provenance(0.9)
            }
          }
        })
      )
    );

    expect(
      getSemanticCandidatePairs().map((pair) => pair.leftId)
    ).toEqual(["a"]);
    expect([...getSemanticPublishedMatches().keys()]).toEqual(["a"]);
  });

  it("reads a missing store as no matches", () => {
    expect(getSemanticCandidatePairs()).toEqual([]);
    expect(getSemanticPublishedMatches().size).toBe(0);
  });
});
