import { describe, expect, it } from "vitest";

import {
  AUTO_REJECT_FLAGS,
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

  it("rejects a defacement signature", () => {
    // The real 2026-10-08 item from the 量子位 feed.
    const candidate = makeImportedCandidate({
      id: "qbitai-defaced",
      originalTitle: "hacked by trenggalek6etar",
      originalSummary: "",
      sourceUrl: "https://www.qbitai.com/2026/10/502081.html",
      importStatus: "new"
    });

    expect(selectAutoRejections([candidate], published)).toEqual([
      {
        candidateId: "qbitai-defaced",
        title: "hacked by trenggalek6etar",
        flag: "defacement_title"
      }
    ]);
    expect(
      selectAutoRejections([candidate], published, new Set(["qbitai-defaced"]))
    ).toEqual([]);
  });

  it("keeps a headline that only mentions being hacked", () => {
    const candidate = makeImportedCandidate({
      originalTitle: "How the router was hacked by researchers",
      importStatus: "new"
    });

    expect(selectAutoRejections([candidate], published)).toEqual([]);
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
        { candidateId: "c", title: "c", flag: "already_published" },
        { candidateId: "d", title: "d", flag: "defacement_title" }
      ])
    ).toBe("自动分诊：拒绝 4 条（预发布版本 2，已发布过 1，疑似篡改 1）。");
  });

  it("says so when nothing matched", () => {
    expect(buildAutoTriageMessage([])).toBe(
      "自动分诊：没有符合自动拒绝规则的候选。"
    );
  });
});

describe("semantic matches and auto-triage", () => {
  it("never rejects on a semantic published match alone", () => {
    // Measured precision at the shipped threshold is about half
    // (eval/dedup/README.md): an editor decides, the task runner does not.
    const candidate = makeImportedCandidate({
      id: "qbitai-gemini-4",
      originalTitle: "谷歌Gemini 4突然发布！RSI加持，GPT和Opus都让让",
      sourceUrl: "https://www.qbitai.com/2026/10/1.html",
      importStatus: "new",
      semanticPublishedMatch: {
        technologyId: "tech-gemini-4-argon",
        technologyTitle: "Gemini 4 Argon",
        score: 0.93
      }
    });

    expect(AUTO_REJECT_FLAGS).not.toContain("similar_to_published");
    expect(selectAutoRejections([candidate], published)).toEqual([]);
  });
});
