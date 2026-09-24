// Runs every `validate:*` npm script in order and stops at the first failure.
// Exists so CI can run the validators with one step, and so a local
// pre-commit sweep does not have to remember all 22 names.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const packageJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
);
const names = Object.keys(packageJson.scripts).filter(
  (name) => name.startsWith("validate:") && name !== "validate:all"
);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const startedAt = Date.now();

for (const name of names) {
  const stepStartedAt = Date.now();
  const result = spawnSync(npmCommand, ["run", "-s", name], {
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    console.error(
      `\n✗ ${name} failed (exit ${result.status ?? "signal"}), stopping.`
    );
    process.exit(result.status ?? 1);
  }

  console.log(
    `✓ ${name} (${((Date.now() - stepStartedAt) / 1000).toFixed(1)}s)`
  );
}

console.log(
  `\nAll ${names.length} validators passed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`
);
