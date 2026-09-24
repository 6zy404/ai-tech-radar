const fs = require("node:fs");
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = process.cwd();
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(
  request,
  parent,
  isMain,
  options
) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      path.join(projectRoot, "src", request.slice(2)),
      parent,
      isMain,
      options
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

function registerTypeScriptExtension(extension) {
  Module._extensions[extension] = function compileTypeScript(module, filename) {
    const source = fs.readFileSync(filename, "utf8");
    const result = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        resolveJsonModule: true,
        target: ts.ScriptTarget.ES2020
      }
    });

    module._compile(result.outputText, filename);
  };
}

registerTypeScriptExtension(".ts");
registerTypeScriptExtension(".tsx");

/**
 * Every validator writes fixtures into the data directory and restores it in
 * a `finally`. Until 2026-09-24 that directory was the real `config/` of
 * whatever checkout the command ran in — on the live machine, the live data —
 * so a `Ctrl+C` left fixtures behind, and anything the server or task runner
 * wrote during a run was clobbered by the restore. Validators now run against
 * a throwaway copy: the data directory (or `config/`) is copied into a temp
 * folder, `LOCAL_DATA_DIR` and `SQLITE_DATABASE_PATH` point at the copy, and
 * the copy is deleted on exit. `VALIDATION_DATA_DIR=live` opts out.
 */
function prepareIsolatedDataDir() {
  if (process.env.VALIDATION_DATA_DIR === "live") {
    return null;
  }

  const configured = process.env.LOCAL_DATA_DIR?.trim() || "config";
  const sourceDir = path.isAbsolute(configured)
    ? configured
    : path.join(projectRoot, configured);
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ai-tech-radar-validate-")
  );

  if (fs.existsSync(sourceDir)) {
    fs.cpSync(sourceDir, tempDir, {
      recursive: true,
      filter: (entry) => !/\.(log|sqlite|sqlite-journal)$/i.test(entry)
    });
  }

  process.env.LOCAL_DATA_DIR = tempDir;
  process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "ai-tech-radar.sqlite");

  process.on("exit", () => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  return { sourceDir, tempDir };
}

const scriptPath = process.argv[2];

if (!scriptPath) {
  console.error("Usage: node scripts/run-ts-validation.cjs <script.ts>");
  process.exitCode = 1;
} else {
  const isolation = prepareIsolatedDataDir();

  if (isolation) {
    console.log(
      `验证数据目录：${isolation.tempDir}（${isolation.sourceDir} 的临时副本，结束后删除）`
    );
  } else {
    console.log(
      "验证数据目录：直接使用真实数据目录（VALIDATION_DATA_DIR=live）"
    );
  }

  require(path.resolve(projectRoot, scriptPath));
}
