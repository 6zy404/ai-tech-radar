// Lets plain `node` require this project's TypeScript: resolves the `@/`
// alias against `src/` and transpiles `.ts` / `.tsx` on load. Shared by the two
// launchers, which differ only in which data directory the script then sees:
//
//   run-ts.cjs             the real one   — task runner, db:* commands
//   run-ts-validation.cjs  a throwaway copy — validate:* and eval:* scripts
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

function registerTypeScript(projectRoot) {
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

  for (const extension of [".ts", ".tsx"]) {
    Module._extensions[extension] = function compileTypeScript(
      module,
      filename
    ) {
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
}

/**
 * Scripts that write fixtures and therefore must only ever see a copy of the
 * data. Decided by file name so that the two launchers can each refuse the
 * other's scripts instead of trusting whoever wrote the npm script.
 */
function isIsolatedScript(scriptPath) {
  return /^(validate|eval)-/.test(path.basename(scriptPath));
}

module.exports = { registerTypeScript, isIsolatedScript };
