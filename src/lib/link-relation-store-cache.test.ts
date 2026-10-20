import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pins the memoization added 2026-10-21 to the relation override store.
 *
 * `getAllLinkRelations()` parsed `link-relation-workspace.json` (487 KB,
 * 1,195 overrides, 2.3 ms) on every call, and a skill page called it twice
 * (the page and the prerequisite chain) with the content graph a third time
 * on topic pages. The parse is now memoized per store revision; the merged
 * list is still built fresh per call.
 *
 * The counter is the store read itself, which is the work being avoided.
 */

const parses = { count: 0 };

vi.mock("@/lib/repositories/local-json-store", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/repositories/local-json-store")
    >();

  return {
    ...actual,
    readLocalJsonFile: <T>(filePath: string, fallbackValue: T): T => {
      if (path.basename(filePath) === "link-relation-workspace.json") {
        parses.count += 1;
      }

      return actual.readLocalJsonFile(filePath, fallbackValue);
    }
  };
});

let dataDir: string;
let previousDataDir: string | undefined;
let previousDriver: string | undefined;

const overrideWithNote = (note: string) => ({
  updatedAt: "2026-10-21T00:00:00.000Z",
  relations: [
    {
      id: "rel-ws-test",
      fromId: "tech-a",
      fromType: "technology",
      toId: "knowledge-b",
      toType: "knowledge",
      relationType: "uses",
      note
    }
  ]
});

const writeStoreFromAnotherProcess = (note: string) => {
  writeFileSync(
    path.join(dataDir, "link-relation-workspace.json"),
    JSON.stringify(overrideWithNote(note))
  );
};

/** Fresh module registry each time, so the module-level cache starts empty. */
const loadWorkflow = async () => {
  vi.resetModules();
  parses.count = 0;

  return {
    workflow: await import("@/lib/link-relation-workflow"),
    store: await import("@/lib/repositories/local-json-store")
  };
};

const noteOf = (
  workflow: typeof import("@/lib/link-relation-workflow")
): string | undefined =>
  workflow.findRelationIn(
    workflow.getAllLinkRelations(),
    "tech-a",
    "technology",
    "knowledge-b",
    "knowledge"
  ).note;

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "link-relation-cache-"));
  previousDataDir = process.env.LOCAL_DATA_DIR;
  previousDriver = process.env.PERSISTENCE_DRIVER;
  process.env.LOCAL_DATA_DIR = dataDir;
  process.env.PERSISTENCE_DRIVER = "json";
  writeStoreFromAnotherProcess("one");
});

afterEach(() => {
  if (previousDataDir === undefined) delete process.env.LOCAL_DATA_DIR;
  else process.env.LOCAL_DATA_DIR = previousDataDir;
  if (previousDriver === undefined) delete process.env.PERSISTENCE_DRIVER;
  else process.env.PERSISTENCE_DRIVER = previousDriver;
  rmSync(dataDir, { recursive: true, force: true });
});

describe("link relation override store", () => {
  it("parses once no matter how many callers ask within a render", async () => {
    const { workflow } = await loadWorkflow();

    for (let i = 0; i < 6; i += 1) {
      workflow.getAllLinkRelations();
    }

    expect(parses.count).toBe(1);
    expect(noteOf(workflow)).toBe("one");
  });

  it("still hands every caller its own array", async () => {
    const { workflow } = await loadWorkflow();

    // A shared array would let one caller's sort reorder another's list.
    expect(workflow.getAllLinkRelations()).not.toBe(
      workflow.getAllLinkRelations()
    );
    expect(workflow.readLinkRelationWorkspaceStore().relations).not.toBe(
      workflow.readLinkRelationWorkspaceStore().relations
    );
  });

  it("re-parses after a write from this process", async () => {
    const { workflow, store } = await loadWorkflow();

    expect(noteOf(workflow)).toBe("one");
    expect(parses.count).toBe(1);

    store.writeLocalJsonFile(
      store.getLocalStoreFilePath("link-relation-workspace.json"),
      overrideWithNote("two")
    );

    expect(noteOf(workflow)).toBe("two");
    expect(parses.count).toBe(2);
  });

  it("re-parses after a write from another process", async () => {
    const { workflow } = await loadWorkflow();

    expect(noteOf(workflow)).toBe("one");
    expect(parses.count).toBe(1);

    // The task runner and an editing dev server write this file from their
    // own process, so the in-process revision counter alone would keep
    // serving the relation an editor had just changed.
    writeStoreFromAnotherProcess("a-note-of-a-different-length-entirely");

    expect(noteOf(workflow)).toBe("a-note-of-a-different-length-entirely");
    expect(parses.count).toBe(2);
  });

  it("does not re-parse when nothing changed between two reads", async () => {
    const { workflow } = await loadWorkflow();

    workflow.getAllLinkRelations();
    workflow.getAllLinkRelations();

    expect(parses.count).toBe(1);
  });

  it("reads a missing file as an empty overlay on every call", async () => {
    rmSync(path.join(dataDir, "link-relation-workspace.json"));
    const { workflow } = await loadWorkflow();

    expect(workflow.readLinkRelationWorkspaceStore().relations).toEqual([]);
    expect(noteOf(workflow)).toBeUndefined();
  });
});
