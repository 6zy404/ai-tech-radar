// @ts-check
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createLineStamper, formatLogTimestamp } from "./log-lines.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const isoLine = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z /;

describe("createLineStamper", () => {
  it("stamps whole lines, joins a line split across chunks, and flushes the tail", () => {
    /** @type {string[]} */
    const out = [];
    const clock = () => new Date("2026-10-21T02:00:00.000Z");
    const stamper = createLineStamper((text) => out.push(text), clock);

    stamper.push("▲ Next.js 15.5.27\n- Local: http://127.0.0.1:3000\n ✓ Rea");
    stamper.push("dy in 412ms\n");
    stamper.push("partial");
    stamper.flush();

    expect(out).toEqual([
      "2026-10-21T02:00:00.000Z ▲ Next.js 15.5.27\n",
      "2026-10-21T02:00:00.000Z - Local: http://127.0.0.1:3000\n",
      "2026-10-21T02:00:00.000Z  ✓ Ready in 412ms\n",
      "2026-10-21T02:00:00.000Z partial\n"
    ]);
  });

  it("keeps blank lines blank and drops a carriage return before the newline", () => {
    /** @type {string[]} */
    const out = [];
    const stamper = createLineStamper(
      (text) => out.push(text),
      () => new Date(0)
    );

    stamper.push("a\r\n\r\n\nb\n");

    expect(out).toEqual([
      "1970-01-01T00:00:00.000Z a\n",
      "\n",
      "\n",
      "1970-01-01T00:00:00.000Z b\n"
    ]);
  });

  it("flushes nothing when there is no tail", () => {
    /** @type {string[]} */
    const out = [];
    const stamper = createLineStamper((text) => out.push(text));

    stamper.push("done\n");
    stamper.flush();

    expect(out).toHaveLength(1);
  });

  it("writes ISO-8601 UTC", () => {
    expect(formatLogTimestamp(new Date("2026-10-21T10:00:00+08:00"))).toBe(
      "2026-10-21T02:00:00.000Z"
    );
  });
});

describe("with-proxy-env.mjs and LOG_TIMESTAMPS", () => {
  const launcher = path.join(repoRoot, "scripts", "with-proxy-env.mjs");
  const probe =
    "console.log('out one'); console.error('err one'); process.stdout.write('tail')";

  it("stamps the child's stdout and stderr and keeps its exit code when LOG_TIMESTAMPS=1", () => {
    const result = spawnSync(
      process.execPath,
      [launcher, "node", "-e", `${probe}; process.exitCode = 3`],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, LOG_TIMESTAMPS: "1", PROXY_ENV_QUIET: "1" },
        timeout: 30000
      }
    );

    expect(result.status).toBe(3);
    expect(result.stdout.split(/\r?\n/).filter(Boolean)).toEqual([
      expect.stringMatching(/^.{24} out one$/),
      expect.stringMatching(/^.{24} tail$/)
    ]);
    expect(result.stderr.split(/\r?\n/).filter(Boolean)).toEqual([
      expect.stringMatching(/^.{24} err one$/)
    ]);
    expect(result.stdout).toMatch(isoLine);
  });

  it("leaves the output alone without the variable", () => {
    const result = spawnSync(
      process.execPath,
      [launcher, "node", "-e", probe],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, LOG_TIMESTAMPS: "", PROXY_ENV_QUIET: "1" },
        timeout: 30000
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("out one\ntail");
    expect(result.stderr).toBe("err one\n");
  });
});
