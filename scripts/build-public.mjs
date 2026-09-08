/**
 * Builds the app with every Internal Workspace route physically absent, so the
 * production output contains only the User-facing Product.
 *
 * Why this exists, and why it is not just the access token:
 * `src/middleware.ts` already guards `/workspace`, `/api/workspace`,
 * `/api/candidates` and the two legacy prefixes, and that guard was verified
 * end to end on 2026-08-10. But it is one lock, it is **off by default**
 * (`WORKSPACE_ACCESS_ENABLED=false` in `.env.example`), and it has already
 * shipped inert once: until 2026-07-27 the middleware sat at the repository
 * root, which a `src/`-directory project silently ignores, so `/workspace`
 * answered `200` to anyone. A route that is not in the build cannot be reached
 * by a misconfiguration, a forgotten env var, or a middleware that fails to
 * load.
 *
 * Why moving files rather than an env-gated `notFound()`: a runtime 404 leaves
 * all 69 route files in the bundle. The point of this script is that they are
 * not there. That is also what makes it verifiable: after the build this script
 * reads the emitted route manifest and fails if a workspace route appears in
 * it, so the claim rests on the build output rather than on this script's own
 * bookkeeping. Separately, `assertPublicBuildExcludesEveryGuardedPrefix` in
 * `scripts/validate-deployment.ts` asserts that EXCLUDED below still covers
 * every prefix `protectedPathPrefixes` guards — that one runs without a build,
 * so drift fails at the moment it is introduced rather than at the next deploy.
 *
 * Recovery: if the process is killed in a way that skips the restore, the
 * stash directory survives with everything in it and the next run refuses to
 * start, printing the exact `git status` / move-back instructions. Nothing is
 * ever deleted.
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const STASH_DIR = path.join(repoRoot, ".public-build-stash");

/**
 * Files `next build` rewrites as a side effect, which must be put back.
 *
 * `tsconfig.json` gets `<distDir>/types/**​/*.ts` appended to `include`, and it
 * accumulates: a verification build to `.next-full` leaves a glob pointing at
 * generated route types for the very workspace routes this script removes, and
 * the next public build then fails its typecheck on modules that are
 * (correctly) absent. `next-env.d.ts` gets its `routes.d.ts` reference
 * repointed at whichever distDir was last built. Both were hit for real while
 * building the control for this script.
 */
const REWRITTEN_BY_BUILD = ["tsconfig.json", "next-env.d.ts"];

/**
 * Every route prefix `src/middleware.ts` protects, expressed as the directory
 * that produces it. Keep the two lists in step: a prefix guarded there but not
 * excluded here would still ship.
 */
const EXCLUDED = [
  "src/app/workspace",
  "src/app/api/workspace",
  "src/app/api/candidates",
  "src/app/candidates",
  "src/app/technologies/drafts"
];

/** Path inside the stash that mirrors the repo-relative path, flattened. */
function stashPathFor(relative) {
  return path.join(STASH_DIR, relative.split("/").join("__"));
}

function moveOut() {
  mkdirSync(STASH_DIR, { recursive: true });
  const moved = [];
  for (const relative of EXCLUDED) {
    const from = path.join(repoRoot, relative);
    if (!existsSync(from)) {
      console.log(`  skip (absent)  ${relative}`);
      continue;
    }
    renameSync(from, stashPathFor(relative));
    moved.push(relative);
    console.log(`  moved out      ${relative}`);
  }
  return moved;
}

function restore(moved) {
  let failed = 0;
  for (const relative of moved) {
    const to = path.join(repoRoot, relative);
    const from = stashPathFor(relative);
    if (!existsSync(from)) {
      console.error(`  !! stash missing for ${relative}`);
      failed += 1;
      continue;
    }
    mkdirSync(path.dirname(to), { recursive: true });
    renameSync(from, to);
    console.log(`  restored       ${relative}`);
  }
  if (failed === 0 && existsSync(STASH_DIR)) {
    rmSync(STASH_DIR, { recursive: true, force: true });
  }
  return failed;
}

/**
 * Reads the emitted route manifest and reports what actually shipped. This is
 * the number that matters — the script's own bookkeeping is not evidence.
 */
function summariseBuiltRoutes(distDir) {
  const manifestPath = path.join(
    repoRoot,
    distDir,
    "app-path-routes-manifest.json"
  );
  if (!existsSync(manifestPath)) {
    return null;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const routes = Object.values(manifest);
  const workspaceRoutes = routes.filter(
    (route) =>
      route.startsWith("/workspace") ||
      route.startsWith("/api/workspace") ||
      route.startsWith("/api/candidates") ||
      route.startsWith("/candidates") ||
      route.startsWith("/technologies/drafts")
  );
  return { total: routes.length, workspaceRoutes };
}

function main() {
  if (existsSync(STASH_DIR)) {
    console.error(
      [
        "",
        `A previous run left ${path.relative(repoRoot, STASH_DIR)} behind, which means`,
        "its restore step did not complete. Nothing was deleted — move the",
        "directories back before building again:",
        "",
        `  ls ${path.relative(repoRoot, STASH_DIR)}`,
        "  # each entry is a repo path with '/' replaced by '__'",
        "  git status --short   # confirm what is missing from src/app",
        ""
      ].join("\n")
    );
    process.exit(1);
  }

  const distDir = process.env.NEXT_DIST_DIR || ".next";
  console.log("Building the public-only bundle.");
  console.log(`  dist dir: ${distDir}`);
  console.log("");

  const before = new Map(
    REWRITTEN_BY_BUILD.filter((name) =>
      existsSync(path.join(repoRoot, name))
    ).map((name) => [name, readFileSync(path.join(repoRoot, name), "utf8")])
  );

  let moved = [];
  let restoreFailures = 0;

  // A killed build must not leave the tree gutted.
  const onSignal = (signal) => {
    console.error(`\nReceived ${signal}; restoring the excluded routes.`);
    restore(moved);
    process.exit(130);
  };
  process.on("SIGINT", () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));

  let status = 1;
  try {
    moved = moveOut();
    console.log("");

    // Resolve Next's JS entry and run it with this Node rather than spawning
    // through a shell: `shell: true` triggers DEP0190, and the same fix was
    // applied to scripts/with-proxy-env.mjs on 2026-08-10.
    const nextBin = require.resolve("next/dist/bin/next");
    const result = spawnSync(process.execPath, [nextBin, "build"], {
      cwd: repoRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        // TopNav renders an 内部工作台 link unconditionally; without this the
        // public site would ship a nav entry pointing at a route that no
        // longer exists.
        NEXT_PUBLIC_WORKSPACE_UI: "off",
        ...(process.env.NEXT_DIST_DIR
          ? { NEXT_DIST_DIR: process.env.NEXT_DIST_DIR }
          : {})
      }
    });
    status = result.status ?? 1;
  } finally {
    console.log("");
    restoreFailures = restore(moved);
    for (const [name, contents] of before) {
      const filePath = path.join(repoRoot, name);
      if (readFileSync(filePath, "utf8") !== contents) {
        writeFileSync(filePath, contents);
        console.log(`  restored       ${name} (next build rewrote it)`);
      }
    }
  }

  if (restoreFailures > 0) {
    console.error(
      `\n${restoreFailures} director(ies) could not be restored. Fix the tree before committing.`
    );
    process.exit(1);
  }

  if (status !== 0) {
    console.error("\nnext build failed; the tree has been restored.");
    process.exit(status);
  }

  const summary = summariseBuiltRoutes(distDir);
  if (!summary) {
    console.error(
      `\nCould not read ${distDir}/app-path-routes-manifest.json to verify the output.`
    );
    process.exit(1);
  }

  console.log("");
  console.log(`Routes in the build: ${summary.total}`);
  console.log(
    `Workspace routes in the build: ${summary.workspaceRoutes.length}`
  );
  if (summary.workspaceRoutes.length > 0) {
    console.error("\nWorkspace routes leaked into the public build:");
    for (const route of summary.workspaceRoutes) {
      console.error(`  ${route}`);
    }
    process.exit(1);
  }
  console.log("\nPublic-only build complete.");
}

main();
