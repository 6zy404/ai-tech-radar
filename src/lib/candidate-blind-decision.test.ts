import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A decision made on the editorial-round console with the triage suggestions
// hidden carries `blind: true` in the review state, which is what
// build-triage-dataset reads to tell clean labels from anchored ones.

let dataDir: string;
let previousDataDir: string | undefined;

beforeEach(() => {
  previousDataDir = process.env.LOCAL_DATA_DIR;
  dataDir = mkdtempSync(path.join(tmpdir(), "blind-decision-"));
  process.env.LOCAL_DATA_DIR = dataDir;
  vi.resetModules();
});

afterEach(() => {
  if (previousDataDir === undefined) {
    delete process.env.LOCAL_DATA_DIR;
  } else {
    process.env.LOCAL_DATA_DIR = previousDataDir;
  }
  rmSync(dataDir, { recursive: true, force: true });
});

const reviewState = () =>
  JSON.parse(
    readFileSync(path.join(dataDir, "candidate-review-state.json"), "utf8")
  ) as { items: Record<string, { importStatus: string; blind?: boolean }> };

describe("updateImportedCandidateStatus blind flag", () => {
  it("records blind only when asked", async () => {
    const { updateImportedCandidateStatus } =
      await import("@/lib/candidate-workflow");

    updateImportedCandidateStatus("c-blind", "rejected", { blind: true });
    updateImportedCandidateStatus("c-seen", "reviewed");

    expect(reviewState().items["c-blind"]).toMatchObject({
      importStatus: "rejected",
      blind: true
    });
    expect(reviewState().items["c-seen"].blind).toBeUndefined();
  });

  it("drops the flag when a decision is reopened or remade with suggestions shown", async () => {
    const { updateImportedCandidateStatus } =
      await import("@/lib/candidate-workflow");

    updateImportedCandidateStatus("c1", "rejected", { blind: true });
    updateImportedCandidateStatus("c1", "new", { blind: true });
    expect(reviewState().items.c1.blind).toBeUndefined();

    updateImportedCandidateStatus("c2", "rejected", { blind: true });
    updateImportedCandidateStatus("c2", "reviewed");
    expect(reviewState().items.c2.blind).toBeUndefined();
  });
});
