import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeImportedCandidate } from "@/lib/test-factories";

/**
 * The refresh runs right after an import, so its one hard requirement is that
 * it cannot hold the import up: a model that is not ready by the deadline must
 * end the run as a timeout, leave the stored matches alone, and say so.
 */

const embedPassages = vi.fn();
const saveSemanticDedupResult = vi.fn();
const saveSemanticDedupRun = vi.fn();

vi.mock("@/lib/embeddings", () => ({
  embedPassages: (...args: unknown[]) => embedPassages(...args)
}));
vi.mock("@/lib/semantic-dedup-store", () => ({
  saveSemanticDedupResult: (...args: unknown[]) =>
    saveSemanticDedupResult(...args),
  saveSemanticDedupRun: (...args: unknown[]) => saveSemanticDedupRun(...args)
}));
vi.mock("@/lib/candidate-workflow", () => ({
  getImportedCandidates: () => [
    makeImportedCandidate({ id: "a", publishDate: "2026-10-12" }),
    makeImportedCandidate({ id: "b", publishDate: "2026-10-12" })
  ]
}));
vi.mock("@/lib/technology-draft-workflow", () => ({
  getPublishedTechnologyWorkspaceRecords: () => []
}));

const { refreshSemanticDuplicateMatches } = await import(
  "@/lib/semantic-dedup-refresh"
);

describe("refreshSemanticDuplicateMatches", () => {
  beforeEach(() => {
    embedPassages.mockReset();
    saveSemanticDedupResult.mockReset();
    saveSemanticDedupRun.mockReset();
  });

  it("gives up at the deadline and keeps the stored matches", async () => {
    // A model load that never finishes — what the mirror did on 2026-09-24.
    embedPassages.mockReturnValue(new Promise(() => undefined));

    const summary = await refreshSemanticDuplicateMatches({ timeoutMs: 20 });

    expect(summary.status).toBe("timeout");
    expect(summary.message).toContain("只用确定性规则");
    expect(saveSemanticDedupResult).not.toHaveBeenCalled();
    expect(saveSemanticDedupRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "timeout" })
    );
  });

  it("reports a model failure instead of throwing", async () => {
    embedPassages.mockRejectedValue(new Error("model load failed"));

    const summary = await refreshSemanticDuplicateMatches({ timeoutMs: 1000 });

    expect(summary.status).toBe("failed");
    expect(summary.message).toContain("model load failed");
    expect(saveSemanticDedupResult).not.toHaveBeenCalled();
  });

  it("saves the pairs it finds and names them in the message", async () => {
    embedPassages.mockImplementation(async (texts: string[]) =>
      texts.map(() => [1, 0, 0])
    );

    const summary = await refreshSemanticDuplicateMatches({ timeoutMs: 1000 });

    expect(summary.status).toBe("success");
    expect(summary.candidatePairCount).toBe(1);
    expect(summary.message).toContain("语义同组 1 对");
    expect(saveSemanticDedupResult).toHaveBeenCalledWith(
      expect.objectContaining({
        coveredCandidateIds: ["a", "b"],
        candidatePairs: [expect.objectContaining({ leftId: "a", rightId: "b" })]
      })
    );
  });
});
