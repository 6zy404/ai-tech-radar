import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * From 2026-09-25 to 09-27 every scheduled import wrote into a throwaway copy
 * of the data directory and was deleted with it, because the task runner was
 * launched through the validators' launcher. These tests hold the two halves
 * apart: what each launcher does to the data directory, and which launcher
 * each npm script uses.
 */

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const MARKER = "launcher-probe.txt";

// A script that does what the task runner does, reduced to the part that
// matters here: it writes into whatever LOCAL_DATA_DIR it was given.
const PROBE_SOURCE = `
const fs = require("node:fs");
const path = require("node:path");
fs.writeFileSync(path.join(process.env.LOCAL_DATA_DIR, "${MARKER}"), "written");
`;

let dataDir;
let scriptDir;

function writeProbe(name) {
  const probePath = path.join(scriptDir, name);

  writeFileSync(probePath, PROBE_SOURCE, "utf8");

  return probePath;
}

function launch(launcher, probePath, extraEnv = {}) {
  const env = { ...process.env, LOCAL_DATA_DIR: dataDir, ...extraEnv };

  delete env.VALIDATION_DATA_DIR;
  Object.assign(env, extraEnv);

  return spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts", launcher), probePath],
    { cwd: repoRoot, env, encoding: "utf8" }
  );
}

beforeEach(() => {
  dataDir = mkdtempSync(path.join(os.tmpdir(), "radar-launcher-data-"));
  scriptDir = mkdtempSync(path.join(os.tmpdir(), "radar-launcher-script-"));
  writeFileSync(path.join(dataDir, "existing.json"), "{}", "utf8");
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(scriptDir, { recursive: true, force: true });
});

describe("run-ts.cjs", () => {
  it("lets an operational script write to the real data directory", () => {
    const result = launch("run-ts.cjs", writeProbe("tasks-probe.ts"));

    expect(result.status).toBe(0);
    expect(existsSync(path.join(dataDir, MARKER))).toBe(true);
  });

  it("says which directory it wrote to", () => {
    const result = launch("run-ts.cjs", writeProbe("tasks-probe.ts"));

    expect(result.stdout).toContain(dataDir);
    expect(result.stdout).toContain("真实数据目录");
  });

  it("refuses a validator, which would write fixtures into live data", () => {
    const result = launch("run-ts.cjs", writeProbe("validate-probe.ts"));

    expect(result.status).toBe(2);
    expect(existsSync(path.join(dataDir, MARKER))).toBe(false);
  });
});

describe("run-ts-validation.cjs", () => {
  it("keeps a validator's writes out of the real data directory", () => {
    const result = launch(
      "run-ts-validation.cjs",
      writeProbe("validate-probe.ts")
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("临时副本");
    expect(existsSync(path.join(dataDir, MARKER))).toBe(false);
  });

  it("refuses the task runner instead of discarding its work", () => {
    const result = launch(
      "run-ts-validation.cjs",
      writeProbe("tasks-runner.ts")
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("run-ts.cjs");
    expect(existsSync(path.join(dataDir, MARKER))).toBe(false);
  });

  it("still honours the explicit opt-out for a validator", () => {
    const result = launch(
      "run-ts-validation.cjs",
      writeProbe("validate-probe.ts"),
      { VALIDATION_DATA_DIR: "live" }
    );

    expect(result.status).toBe(0);
    expect(existsSync(path.join(dataDir, MARKER))).toBe(true);
  });
});

describe("package.json scripts", () => {
  const scripts = JSON.parse(
    readFileSync(path.join(repoRoot, "package.json"), "utf8")
  ).scripts;
  const launched = Object.entries(scripts)
    .map(([name, command]) => ({
      name,
      launcher: /scripts\/(run-ts(?:-validation)?\.cjs)/.exec(command)?.[1],
      target: /scripts\/run-ts(?:-validation)?\.cjs\s+scripts\/(\S+)/.exec(
        command
      )?.[1]
    }))
    .filter((entry) => entry.launcher);

  it("finds the scripts it is supposed to check", () => {
    expect(launched.length).toBeGreaterThan(25);
  });

  it("runs only validators and evals on a throwaway copy", () => {
    const misplaced = launched
      .filter((entry) => entry.launcher === "run-ts-validation.cjs")
      .filter((entry) => !/^(validate|eval)-/.test(entry.target))
      .map((entry) => entry.name);

    expect(misplaced).toEqual([]);
  });

  it("runs the task runner and the db commands on the real directory", () => {
    const operational = launched
      .filter((entry) => entry.launcher === "run-ts.cjs")
      .map((entry) => entry.name)
      .sort();

    expect(operational).toEqual([
      "db:init",
      "db:migrate-json",
      "db:reset",
      "tasks:run-once",
      "tasks:watch"
    ]);
  });
});
