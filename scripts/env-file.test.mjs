// @ts-check
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadEnvFileKeys } from "./env-file.mjs";

/** @type {string} */
let dir;

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "env-file-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** @param {string} contents */
function writeEnvFile(contents) {
  const file = path.join(dir, ".env.local");

  writeFileSync(file, contents, "utf8");

  return file;
}

describe("loadEnvFileKeys", () => {
  it("fills only the listed keys, and only where the environment is unset", () => {
    const file = writeEnvFile(
      [
        "# proxy",
        "HTTPS_PROXY=http://127.0.0.1:7890",
        'NEXT_PUBLIC_SITE_URL="https://aizyradar.cn"',
        "LOCAL_DATA_DIR=C:/live/config",
        "LLM_API_KEY=sk-secret"
      ].join("\r\n")
    );
    /** @type {Record<string, string | undefined>} */
    const env = { HTTPS_PROXY: "http://10.0.0.1:8080" };

    const loaded = loadEnvFileKeys(
      file,
      ["HTTPS_PROXY", "NEXT_PUBLIC_SITE_URL"],
      env
    );

    expect(loaded).toEqual(["NEXT_PUBLIC_SITE_URL"]);
    expect(env).toEqual({
      HTTPS_PROXY: "http://10.0.0.1:8080",
      NEXT_PUBLIC_SITE_URL: "https://aizyradar.cn"
    });
  });

  it("treats a whitespace-only environment value as unset", () => {
    const file = writeEnvFile("NEXT_PUBLIC_SITE_URL=https://aizyradar.cn\n");
    /** @type {Record<string, string | undefined>} */
    const env = { NEXT_PUBLIC_SITE_URL: "  " };

    expect(loadEnvFileKeys(file, ["NEXT_PUBLIC_SITE_URL"], env)).toEqual([
      "NEXT_PUBLIC_SITE_URL"
    ]);
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://aizyradar.cn");
  });

  it("skips empty values, comments and malformed lines", () => {
    const file = writeEnvFile(
      ["NEXT_PUBLIC_SITE_URL=", "=nokey", "garbage", "# NO_PROXY=x"].join("\n")
    );
    /** @type {Record<string, string | undefined>} */
    const env = {};

    expect(
      loadEnvFileKeys(file, ["NEXT_PUBLIC_SITE_URL", "NO_PROXY"], env)
    ).toEqual([]);
    expect(env).toEqual({});
  });

  it("does nothing when the file is absent", () => {
    /** @type {Record<string, string | undefined>} */
    const env = {};

    expect(
      loadEnvFileKeys(path.join(dir, "missing"), ["NO_PROXY"], env)
    ).toEqual([]);
    expect(env).toEqual({});
  });
});
