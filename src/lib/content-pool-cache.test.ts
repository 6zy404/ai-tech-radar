import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pins the memoization added 2026-08-18.
 *
 * `resolveTitle` and `resolveSlug` each call one of the `getAllX()` getters and
 * then `.find()` the single item they want, and every caller of those resolvers
 * is a per-item loop — `getContentGraph` runs both for every node. That was 144
 * full reads of a 524 KB store on one render of `/network`, and it grew in
 * silently as the content grew, which is the shape a comment does not catch.
 *
 * The counter is `getMergedPublicSkills`: it runs exactly once per pool build
 * and is the work being avoided, so "was this really rebuilt" can be asserted
 * without reaching into the cache.
 */

const mergeCalls = { skills: 0, knowledge: 0 };

vi.mock("@/lib/skill-workflow", () => ({
  getMergedPublicSkills: (seeds: unknown[]) => {
    mergeCalls.skills += 1;
    return seeds;
  }
}));

vi.mock("@/lib/knowledge-workflow", () => ({
  getMergedPublicKnowledge: (seeds: unknown[]) => {
    mergeCalls.knowledge += 1;
    return seeds;
  }
}));

let dataDir: string;
let previousDataDir: string | undefined;

const writeStores = (marker: string) => {
  writeFileSync(
    path.join(dataDir, "skill-workspace.json"),
    JSON.stringify({ records: [], marker })
  );
  writeFileSync(
    path.join(dataDir, "knowledge-workspace.json"),
    JSON.stringify({ records: [], marker })
  );
  writeFileSync(
    path.join(dataDir, "technology-workspace.json"),
    JSON.stringify({ records: [], marker })
  );
};

/** Fresh module registry each time, so the module-level cache starts empty. */
const loadContent = async () => {
  vi.resetModules();
  mergeCalls.skills = 0;
  mergeCalls.knowledge = 0;
  return {
    content: await import("@/lib/content"),
    store: await import("@/lib/repositories/local-json-store")
  };
};

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "content-pool-"));
  previousDataDir = process.env.LOCAL_DATA_DIR;
  process.env.LOCAL_DATA_DIR = dataDir;
  writeStores("one");
});

afterEach(() => {
  if (previousDataDir === undefined) delete process.env.LOCAL_DATA_DIR;
  else process.env.LOCAL_DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
});

describe("merged content pools", () => {
  it("merges once no matter how many callers ask within a render", async () => {
    const { content } = await loadContent();

    for (let i = 0; i < 6; i += 1) {
      content.getAllSkills();
      content.getAllKnowledge();
    }

    expect(mergeCalls.skills).toBe(1);
    expect(mergeCalls.knowledge).toBe(1);
  });

  it("still hands every caller its own array", async () => {
    const { content } = await loadContent();

    // A shared array would let one caller's sort reorder another's list.
    expect(content.getAllSkills()).not.toBe(content.getAllSkills());
  });

  it("rebuilds after a write from this process", async () => {
    const { content, store } = await loadContent();

    content.getAllSkills();
    expect(mergeCalls.skills).toBe(1);

    store.writeLocalJsonFile(
      store.getLocalStoreFilePath("skill-workspace.json"),
      { records: [], marker: "two" }
    );

    content.getAllSkills();
    expect(mergeCalls.skills).toBe(2);
  });

  it("rebuilds after a write from another process", async () => {
    const { content } = await loadContent();

    content.getAllKnowledge();
    expect(mergeCalls.knowledge).toBe(1);

    // `tasks:run-once` writes these files from its own process, so the
    // in-process revision counter alone would keep serving a stale pool.
    writeStores("a-marker-of-a-different-length-entirely");

    content.getAllKnowledge();
    expect(mergeCalls.knowledge).toBe(2);
  });

  it("does not rebuild when nothing changed between two reads", async () => {
    const { content } = await loadContent();

    content.getAllSkills();
    content.getAllSkills();

    expect(mergeCalls.skills).toBe(1);
  });
});
