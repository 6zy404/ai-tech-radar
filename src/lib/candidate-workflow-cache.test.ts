import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pins the memoization added 2026-08-17.
 *
 * `getCandidateWorkflowData` parses about 3.3 MB of JSON and then runs the
 * pairwise duplicate analysis, and three getters route through it — so before
 * it was cached, `/workspace` spent 125 seconds in roughly 620 rebuilds and
 * blocked every other route while it did. The defect grew in silently as the
 * candidate pool grew, which is exactly the shape that needs a test rather than
 * a comment.
 *
 * `analyzeDuplicates` is the counter here because it runs exactly once per
 * build and is the expensive half, so counting it answers "was this really
 * rebuilt" without reaching into the cache itself.
 */

const analyzeDuplicatesCalls = { count: 0 };

vi.mock("@/lib/candidate-duplicate-store", () => ({
  analyzeDuplicates: (candidates: unknown[]) => {
    analyzeDuplicatesCalls.count += 1;
    return { candidates, pairReasons: {}, groups: [] };
  },
  readDuplicateGroupStore: () => ({ groups: [] }),
  writeDuplicateGroupStore: () => undefined
}));

let dataDir: string;
let previousDataDir: string | undefined;

const writeStores = (candidateId: string) => {
  writeFileSync(
    path.join(dataDir, "imported-candidates.live.json"),
    JSON.stringify({
      lastSyncedAt: "2026-08-17T00:00:00.000Z",
      candidates: [
        {
          id: candidateId,
          sourceType: "rss",
          sourceName: "Example",
          sourceUrl: `https://example.com/${candidateId}`,
          originalTitle: "Example",
          originalLanguage: "en",
          publishDate: "2026-08-17",
          publisherName: "Example",
          normalizedType: "tool",
          tags: [],
          importStatus: "new",
          relatedCandidateIds: [],
          rawPayload: {}
        }
      ]
    })
  );
  writeFileSync(
    path.join(dataDir, "candidate-review-state.json"),
    JSON.stringify({ updatedAt: "2026-08-17T00:00:00.000Z", items: {} })
  );
  writeFileSync(
    path.join(dataDir, "technology-workspace.json"),
    JSON.stringify({ records: [] })
  );
};

/** Fresh module registry each time, so the module-level cache starts empty. */
const loadWorkflow = async () => {
  vi.resetModules();
  analyzeDuplicatesCalls.count = 0;
  return {
    workflow: await import("@/lib/candidate-workflow"),
    store: await import("@/lib/repositories/local-json-store")
  };
};

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "cwd-cache-"));
  previousDataDir = process.env.LOCAL_DATA_DIR;
  process.env.LOCAL_DATA_DIR = dataDir;
  writeStores("candidate-one");
});

afterEach(() => {
  if (previousDataDir === undefined) delete process.env.LOCAL_DATA_DIR;
  else process.env.LOCAL_DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
});

describe("getCandidateWorkflowData memoization", () => {
  it("builds once no matter how many callers ask within a render", async () => {
    const { workflow } = await loadWorkflow();

    for (let i = 0; i < 5; i += 1) workflow.getCandidateWorkflowData();
    workflow.getImportedCandidates();
    workflow.getDuplicateGroups();

    expect(analyzeDuplicatesCalls.count).toBe(1);
  });

  it("rebuilds after a write from this process", async () => {
    const { workflow, store } = await loadWorkflow();

    workflow.getCandidateWorkflowData();
    expect(analyzeDuplicatesCalls.count).toBe(1);

    // Any store write bumps the revision, which is what the key holds.
    store.writeLocalJsonFile(
      store.getLocalStoreFilePath("candidate-review-state.json"),
      { updatedAt: "2026-08-17T01:00:00.000Z", items: {} }
    );

    workflow.getCandidateWorkflowData();
    expect(analyzeDuplicatesCalls.count).toBe(2);
  });

  it("rebuilds after a write from another process", async () => {
    const { workflow } = await loadWorkflow();

    workflow.getCandidateWorkflowData();
    expect(analyzeDuplicatesCalls.count).toBe(1);

    // The task runner writes these same files from `tasks:run-once`, so the
    // in-process revision counter alone would keep serving a stale view.
    writeStores("candidate-two-with-a-different-length");

    workflow.getCandidateWorkflowData();
    expect(analyzeDuplicatesCalls.count).toBe(2);
  });

  it("does not rebuild when nothing changed between two reads", async () => {
    const { workflow } = await loadWorkflow();

    workflow.getCandidateWorkflowData();
    workflow.getCandidateWorkflowData();

    expect(analyzeDuplicatesCalls.count).toBe(1);
  });
});

describe("getLocalStoreFingerprint", () => {
  it("is stable while the files are, and moves when one changes", async () => {
    const { store } = await loadWorkflow();
    const names = ["imported-candidates.live.json"];

    const before = store.getLocalStoreFingerprint(names);
    expect(store.getLocalStoreFingerprint(names)).toBe(before);

    writeStores("candidate-three-longer-than-the-previous-one");

    expect(store.getLocalStoreFingerprint(names)).not.toBe(before);
  });

  it("reports a missing file rather than throwing", async () => {
    const { store } = await loadWorkflow();

    expect(store.getLocalStoreFingerprint(["not-a-real-store.json"])).toContain(
      "absent"
    );
  });
});
