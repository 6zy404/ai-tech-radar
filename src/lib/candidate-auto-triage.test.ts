import { describe, expect, it } from "vitest";

import {
  buildAutoTriageMessage,
  selectAutoRejections
} from "@/lib/candidate-auto-triage";
import { buildPublishedSignalFingerprints } from "@/lib/quality-signals";
import { makeImportedCandidate } from "@/lib/test-factories";

const published = buildPublishedSignalFingerprints([
  {
    id: "tech-gemini-flash-cyber",
    sourceUrl:
      "https://deepmind.google/blog/introducing-gemini-36-flash-35-flash-lite-and-35-flash-cyber/",
    title: {
      original:
        "Introducing Gemini 3.6 Flash, 3.5 Flash-Lite, and 3.5 Flash Cyber"
    }
  }
]);

describe("selectAutoRejections", () => {
  it("rejects a pre-release whose title looks stable but whose tag is not", () => {
    // The real 2026-09-19 case: Ollama titles the release `v0.34.3` while the
    // tag it points at is `v0.34.3-rc0`.
    const candidate = makeImportedCandidate({
      id: "ollama-rc",
      originalTitle: "v0.34.3",
      sourceUrl: "https://github.com/ollama/ollama/releases/tag/v0.34.3-rc0",
      importStatus: "new"
    });

    expect(selectAutoRejections([candidate], published)).toEqual([
      { candidateId: "ollama-rc", title: "v0.34.3", flag: "prerelease_version" }
    ]);
  });

  it("rejects a pre-release named in the title", () => {
    const candidate = makeImportedCandidate({
      id: "vllm-rc",
      originalTitle: "v0.30.0rc2",
      sourceUrl: "https://github.com/vllm-project/vllm/releases/tag/v0.30.0rc2",
      importStatus: "new"
    });

    expect(selectAutoRejections([candidate], published)[0]?.flag).toBe(
      "prerelease_version"
    );
  });

  it("rejects an announcement that is already published", () => {
    const candidate = makeImportedCandidate({
      id: "gemini-again",
      originalTitle:
        "Introducing Gemini 3.6 Flash, 3.5 Flash-Lite, and 3.5 Flash Cyber",
      sourceUrl:
        "https://deepmind.google/blog/introducing-gemini-3-6-flash-3-5-flash-lite-and-3-5-flash-cyber/",
      importStatus: "new"
    });

    expect(selectAutoRejections([candidate], published)[0]?.flag).toBe(
      "already_published"
    );
  });

  it("keeps stable release tags", () => {
    const stable = makeImportedCandidate({
      originalTitle: "v0.34.2",
      sourceUrl: "https://github.com/ollama/ollama/releases/tag/v0.34.2",
      importStatus: "new"
    });
    const proto = makeImportedCandidate({
      originalTitle: "proto-v0.3.0",
      sourceUrl:
        "https://github.com/vllm-project/vllm/releases/tag/proto-v0.3.0",
      importStatus: "new"
    });

    expect(selectAutoRejections([stable, proto], published)).toEqual([]);
  });

  it("keeps title-only items, which have produced published signals", () => {
    const titleOnly = makeImportedCandidate({
      originalTitle: "Bringing Nunchaku 4-bit Diffusion Inference",
      originalSummary: "",
      originalContent: "",
      importStatus: "new"
    });

    expect(selectAutoRejections([titleOnly], published)).toEqual([]);
  });

  it("leaves a candidate an editor reopened to new", () => {
    // Status alone cannot tell a reopen from a fresh import; the review-state
    // entry can.
    const reopened = makeImportedCandidate({
      id: "reopened-rc",
      originalTitle: "v0.34.3-rc0",
      importStatus: "new"
    });

    expect(selectAutoRejections([reopened], published)).toHaveLength(1);
    expect(
      selectAutoRejections([reopened], published, new Set(["reopened-rc"]))
    ).toEqual([]);
  });

  it("never overrides an editor's decision", () => {
    const decided = ["reviewed", "converted", "rejected"].map((status) =>
      makeImportedCandidate({
        originalTitle: "v0.34.3-rc0",
        importStatus: status as "reviewed" | "converted" | "rejected"
      })
    );

    expect(selectAutoRejections(decided, published)).toEqual([]);
  });
});

describe("buildAutoTriageMessage", () => {
  it("counts rejections per reason", () => {
    expect(
      buildAutoTriageMessage([
        { candidateId: "a", title: "a", flag: "prerelease_version" },
        { candidateId: "b", title: "b", flag: "prerelease_version" },
        { candidateId: "c", title: "c", flag: "already_published" }
      ])
    ).toBe("自动分诊：拒绝 3 条（预发布版本 2，已发布过 1）。");
  });

  it("says so when nothing matched", () => {
    expect(buildAutoTriageMessage([])).toBe(
      "自动分诊：没有符合自动拒绝规则的候选。"
    );
  });
});
