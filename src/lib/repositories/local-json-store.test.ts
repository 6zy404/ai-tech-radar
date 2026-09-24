import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pins the two behaviours added 2026-09-24 after a whole-project review:
 *
 * 1. Writes are temp-file-then-rename, so a crash or a concurrent reader can
 *    never observe a truncated store.
 * 2. A store file that exists but does not parse throws instead of returning
 *    the fallback — because every store is read-modify-write of the whole
 *    file, the old behaviour turned one damaged read into a full overwrite.
 */

const renameFailures = { remaining: 0, code: "EPERM" };

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();

  return {
    ...actual,
    renameSync: (from: string, to: string) => {
      if (renameFailures.remaining > 0) {
        renameFailures.remaining -= 1;
        const error = new Error(`simulated ${renameFailures.code}`) as Error & {
          code: string;
        };
        error.code = renameFailures.code;
        throw error;
      }

      return actual.renameSync(from, to);
    }
  };
});

let dataDir: string;
let previousDataDir: string | undefined;
let previousDriver: string | undefined;

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "local-json-store-"));
  previousDataDir = process.env.LOCAL_DATA_DIR;
  previousDriver = process.env.PERSISTENCE_DRIVER;
  process.env.LOCAL_DATA_DIR = dataDir;
  process.env.PERSISTENCE_DRIVER = "json";
  renameFailures.remaining = 0;
  vi.resetModules();
});

afterEach(() => {
  if (previousDataDir === undefined) {
    delete process.env.LOCAL_DATA_DIR;
  } else {
    process.env.LOCAL_DATA_DIR = previousDataDir;
  }

  if (previousDriver === undefined) {
    delete process.env.PERSISTENCE_DRIVER;
  } else {
    process.env.PERSISTENCE_DRIVER = previousDriver;
  }

  rmSync(dataDir, { recursive: true, force: true });
});

async function loadStore() {
  return import("@/lib/repositories/local-json-store");
}

describe("writeLocalJsonFile", () => {
  it("writes the file and leaves no temp file behind", async () => {
    const store = await loadStore();
    const filePath = store.getLocalStoreFilePath("example.json");

    store.writeLocalJsonFile(filePath, { items: [1, 2, 3] });

    expect(JSON.parse(readFileSync(filePath, "utf8"))).toEqual({
      items: [1, 2, 3]
    });
    expect(readdirSync(dataDir)).toEqual(["example.json"]);
  });

  it("replaces the previous version in one step and keeps the old one until then", async () => {
    const store = await loadStore();
    const filePath = store.getLocalStoreFilePath("example.json");

    store.writeLocalJsonFile(filePath, { version: 1 });
    store.writeLocalJsonFile(filePath, { version: 2 });

    expect(JSON.parse(readFileSync(filePath, "utf8"))).toEqual({ version: 2 });
    expect(readdirSync(dataDir)).toEqual(["example.json"]);
  });

  it("retries the rename while another process holds the file, then succeeds", async () => {
    const store = await loadStore();
    const filePath = store.getLocalStoreFilePath("busy.json");
    renameFailures.remaining = 2;
    renameFailures.code = "EBUSY";

    store.writeLocalJsonFile(filePath, { ok: true });

    expect(JSON.parse(readFileSync(filePath, "utf8"))).toEqual({ ok: true });
    expect(readdirSync(dataDir)).toEqual(["busy.json"]);
  });

  it("gives up after the retry budget, removes the temp file and leaves the target untouched", async () => {
    const store = await loadStore();
    const filePath = store.getLocalStoreFilePath("locked.json");
    writeFileSync(filePath, '{"version":1}\n', "utf8");
    renameFailures.remaining = 99;
    renameFailures.code = "EPERM";

    expect(() =>
      store.writeFileAtomically(filePath, '{"version":2}\n', { attempts: 3 })
    ).toThrow(/EPERM/);

    expect(JSON.parse(readFileSync(filePath, "utf8"))).toEqual({ version: 1 });
    expect(readdirSync(dataDir)).toEqual(["locked.json"]);
  });

  it("does not retry errors that are not a transient lock", async () => {
    const store = await loadStore();
    const filePath = store.getLocalStoreFilePath("other.json");
    renameFailures.remaining = 1;
    renameFailures.code = "ENOENT";

    expect(() => store.writeFileAtomically(filePath, "{}\n")).toThrow(/ENOENT/);
    expect(existsSync(filePath)).toBe(false);
    expect(readdirSync(dataDir)).toEqual([]);
  });
});

describe("readLocalJsonFile", () => {
  it("returns the fallback only when the file is absent", async () => {
    const store = await loadStore();
    const filePath = store.getLocalStoreFilePath("missing.json");

    expect(store.readLocalJsonFile(filePath, { fallback: true })).toEqual({
      fallback: true
    });
  });

  it("throws on a damaged file instead of handing back the fallback", async () => {
    const store = await loadStore();
    const filePath = store.getLocalStoreFilePath("damaged.json");
    writeFileSync(filePath, '{"candidates": [', "utf8");

    expect(() => store.readLocalJsonFile(filePath, { candidates: [] })).toThrow(
      store.LocalJsonStoreError
    );
    expect(() => store.readLocalJsonFile(filePath, { candidates: [] })).toThrow(
      /damaged\.json/
    );
    expect(() =>
      store.readLocalJsonDiskFile(filePath, { candidates: [] })
    ).toThrow(store.LocalJsonStoreError);
  });

  it("treats an empty file as damaged too, because a crashed legacy write left one", async () => {
    const store = await loadStore();
    const filePath = store.getLocalStoreFilePath("empty.json");
    writeFileSync(filePath, "", "utf8");

    expect(() => store.readLocalJsonFile(filePath, {})).toThrow(
      store.LocalJsonStoreError
    );
  });
});
