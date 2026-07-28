import { describe, expect, it } from "vitest";

import {
  buildPublishedSignalFingerprints,
  evaluateCandidateQuality
} from "@/lib/quality-signals";
import { makeImportedCandidate } from "@/lib/test-factories";

// Mirrors the real 2026-07-28 case this flag was built for: the announcement
// was published as `gemini-flash-cyber`, then re-imported a week later under a
// differently hyphenated slug with a byte-identical title.
const publishedGemini = {
  id: "tech-gemini-flash-cyber",
  sourceUrl:
    "https://deepmind.google/blog/introducing-gemini-36-flash-35-flash-lite-and-35-flash-cyber/",
  title: {
    original:
      "Introducing Gemini 3.6 Flash, 3.5 Flash-Lite, and 3.5 Flash Cyber",
    zh: "Google Gemini Flash Cyber：面向漏洞发现与修复的轻量安全模型"
  }
};

function flagsFor(
  candidate: Parameters<typeof evaluateCandidateQuality>[0],
  published = [publishedGemini]
) {
  return evaluateCandidateQuality(candidate, {
    publishedSignals: buildPublishedSignalFingerprints(published)
  }).flags;
}

describe("already_published candidate quality flag", () => {
  it("does not fire when no published signals are supplied", () => {
    const candidate = makeImportedCandidate({
      originalTitle: "Introducing Gemini 3.6 Flash Cyber",
      sourceUrl: publishedGemini.sourceUrl
    });

    expect(evaluateCandidateQuality(candidate).flags).not.toContain(
      "already_published"
    );
    expect(evaluateCandidateQuality(candidate).isAlreadyPublished).toBe(false);
  });

  it("fires on a matching source URL", () => {
    const candidate = makeImportedCandidate({
      originalTitle: "Something else entirely",
      sourceUrl: publishedGemini.sourceUrl
    });

    expect(flagsFor(candidate)).toContain("already_published");
  });

  it("ignores trailing slash and tracking parameters on the URL", () => {
    const candidate = makeImportedCandidate({
      originalTitle: "Something else entirely",
      sourceUrl:
        "https://deepmind.google/blog/introducing-gemini-36-flash-35-flash-lite-and-35-flash-cyber?utm_source=rss#top"
    });

    expect(flagsFor(candidate)).toContain("already_published");
  });

  // The case this flag exists for: the same announcement re-imported under a
  // differently hyphenated slug, after its earlier twin aged out of the
  // rolling candidate snapshot, so duplicate detection cannot see it.
  it("fires on the same title even when the URL slug differs", () => {
    const candidate = makeImportedCandidate({
      originalTitle: publishedGemini.title.original,
      sourceUrl:
        "https://deepmind.google/blog/introducing-gemini-3-6-flash-3-5-flash-lite-and-3-5-flash-cyber/"
    });

    expect(flagsFor(candidate)).toContain("already_published");
  });

  // The narrower sibling announcement from the same round scores exactly at
  // the threshold (4 of 5 shared tokens), which is why the bar sits at 0.8.
  it("fires on a closely related title at the similarity threshold", () => {
    const candidate = makeImportedCandidate({
      originalTitle: "Introducing Gemini 3.5 Flash Cyber",
      sourceUrl:
        "https://deepmind.google/blog/introducing-gemini-3-5-flash-cyber/"
    });

    expect(flagsFor(candidate)).toContain("already_published");
  });

  it("does not fire on an unrelated announcement from the same vendor", () => {
    const candidate = makeImportedCandidate({
      originalTitle: "Gemini API Managed Agents adds background tasks",
      sourceUrl: "https://blog.google/gemini-api-managed-agents/"
    });

    expect(flagsFor(candidate)).not.toContain("already_published");
  });

  it("does not flag a candidate against the signal it was converted into", () => {
    const candidate = makeImportedCandidate({
      originalTitle: "Introducing Gemini 3.6 Flash Cyber",
      sourceUrl: publishedGemini.sourceUrl,
      importStatus: "converted",
      convertedTechnologyId: publishedGemini.id
    });

    expect(flagsFor(candidate)).not.toContain("already_published");
  });

  it("still flags a converted candidate against a different published signal", () => {
    const candidate = makeImportedCandidate({
      originalTitle: "Introducing Gemini 3.6 Flash Cyber",
      sourceUrl: publishedGemini.sourceUrl,
      importStatus: "converted",
      convertedTechnologyId: "tech-something-else"
    });

    expect(flagsFor(candidate)).toContain("already_published");
  });

  it("matches against a Chinese published title as well as the original", () => {
    const candidate = makeImportedCandidate({
      originalTitle: publishedGemini.title.zh,
      sourceUrl: "https://example.com/mirror/gemini-flash-cyber"
    });

    expect(flagsFor(candidate)).toContain("already_published");
  });

  // Known limitation, recorded rather than worked around: comparison tokens
  // are latin-only, so two different all-Chinese titles share no tokens and
  // can never match. Imported candidates come from English-language feeds, so
  // this costs nothing today.
  it("cannot match two all-Chinese titles with no shared latin tokens", () => {
    const candidate = makeImportedCandidate({
      originalTitle: "面向漏洞发现与修复的轻量安全模型",
      sourceUrl: "https://example.com/mirror/other"
    });

    expect(flagsFor(candidate)).not.toContain("already_published");
  });
});

describe("buildPublishedSignalFingerprints", () => {
  it("collects every non-empty localized title", () => {
    expect(
      buildPublishedSignalFingerprints([
        {
          id: "tech-1",
          sourceUrl: "https://example.com/a",
          title: { original: "Original", zh: "中文", en: "  " }
        }
      ])
    ).toEqual([
      {
        id: "tech-1",
        sourceUrl: "https://example.com/a",
        titles: ["Original", "中文"]
      }
    ]);
  });
});
