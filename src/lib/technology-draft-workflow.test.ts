import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pins that editing a published signal cannot give it another signal's slug.
 * The publish gate checked uniqueness only at publish time, so an edit after
 * publishing could make the other signal's public page unreachable.
 */

function makeRecord(id: string, slug: string, status: string) {
  return {
    id,
    slug,
    status,
    sourceLanguage: "en",
    translationStatus: "full",
    title: { original: `Title ${id}`, zh: `标题 ${id}` },
    summary: { original: `Summary ${id}`, zh: `摘要 ${id}` },
    content: { original: `Content ${id}`, zh: `正文 ${id}` },
    type: "tool",
    publishDate: "2026-10-01",
    sourceName: "Example",
    sourceUrl: `https://example.com/${id}`,
    publisherName: "Example",
    publisherType: "startup",
    importanceLevel: "signal",
    tags: [],
    relatedKnowledgeIds: [],
    relatedSkillIds: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    editorialNotes: []
  };
}

describe("updateTechnologyWorkspaceRecord: slug of a published signal", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;
  const storeFile = () => path.join(dataDir, "technology-workspace.json");

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(tmpdir(), "tech-draft-slug-"));
    previousDataDir = process.env.LOCAL_DATA_DIR;
    process.env.LOCAL_DATA_DIR = dataDir;
    writeFileSync(
      storeFile(),
      JSON.stringify({
        updatedAt: "2026-10-01T00:00:00.000Z",
        records: [
          makeRecord("record-a", "slug-test-alpha", "published"),
          makeRecord("record-b", "slug-test-beta", "published"),
          makeRecord("record-c", "slug-test-gamma", "draft")
        ]
      })
    );
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

  it("refuses a slug another signal already uses and writes nothing", async () => {
    const workflow = await import("@/lib/technology-draft-workflow");
    const before = readFileSync(storeFile(), "utf8");

    expect(() =>
      workflow.updateTechnologyWorkspaceRecord("record-b", {
        slug: "slug-test-alpha"
      })
    ).toThrow(/slug-test-alpha/);
    expect(readFileSync(storeFile(), "utf8")).toBe(before);
  });

  it("still saves a published signal under a free slug", async () => {
    const workflow = await import("@/lib/technology-draft-workflow");

    expect(
      workflow.updateTechnologyWorkspaceRecord("record-b", {
        slug: "slug-test-delta"
      }).slug
    ).toBe("slug-test-delta");
  });

  it("leaves drafts to the publish gate", async () => {
    const workflow = await import("@/lib/technology-draft-workflow");

    expect(
      workflow.updateTechnologyWorkspaceRecord("record-c", {
        slug: "slug-test-alpha"
      }).slug
    ).toBe("slug-test-alpha");
  });
});
