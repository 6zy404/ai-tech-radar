// Runs an operational TypeScript script — the task runner, the db:* commands —
// against the REAL data directory.
//
// This file exists because of four days of lost imports. Until 2026-09-28 these
// scripts were launched through `run-ts-validation.cjs`, which was only ever a
// TypeScript loader. On 2026-09-24 that launcher started pointing
// `LOCAL_DATA_DIR` at a throwaway copy to protect the live data from
// validators, and the task runner went with it: every scheduled import from
// 09-25 to 09-27 fetched its sources, reported "新增候选 31 条", wrote them
// into a temp folder and deleted the folder on exit. The log looked healthy.
const path = require("node:path");

const { isIsolatedScript, registerTypeScript } = require("./ts-register.cjs");

const projectRoot = process.cwd();
const scriptPath = process.argv[2];

if (!scriptPath) {
  console.error("Usage: node scripts/run-ts.cjs <script.ts> [args...]");
  process.exit(2);
}

if (isIsolatedScript(scriptPath)) {
  console.error(
    `${path.basename(scriptPath)} 会写入测试数据，不能在真实数据目录上运行。请改用 scripts/run-ts-validation.cjs。`
  );
  process.exit(2);
}

const configured = process.env.LOCAL_DATA_DIR?.trim() || "config";
const dataDir = path.isAbsolute(configured)
  ? configured
  : path.join(projectRoot, configured);

// Stated on every run, so the log says where the writes went. Its absence is
// how the lost imports stayed invisible.
console.log(`数据目录：${dataDir}（真实数据目录）`);

registerTypeScript(projectRoot);
// The script reads its own arguments from process.argv.slice(3), as before.
require(path.resolve(projectRoot, scriptPath));
