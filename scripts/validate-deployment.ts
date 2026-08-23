import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

import {
  renderDigestJsonFeed,
  renderDigestRssXml
} from "../src/lib/digest-delivery";
import { maskEndpointUrl } from "../src/lib/delivery-workflow";
import { getLocalDataDirPath } from "../src/lib/local-data";
import {
  checkWorkspaceAccess,
  isProtectedWorkspacePath,
  isWorkspaceAccessEnabled
} from "../src/lib/workspace-access";

const packageJsonPath = path.join(process.cwd(), "package.json");
const internalOnlyTerms = [
  "rawPayload",
  "importStatus",
  "normalizedType",
  "duplicateGroupId",
  "qualityFlags",
  "candidateQuality",
  "sourceQuality",
  "editorialNotes",
  "manuallyAddedTechnologyIds",
  "excludedTechnologyIds",
  "pinnedTechnologyIds",
  "orderedTechnologyIds",
  "endpointUrl",
  "DeliveryChannel",
  "DeliveryRun",
  "ScheduledDelivery",
  "TaskRunner",
  "WORKSPACE_ACCESS_TOKEN"
];

/**
 * The workspace guard only runs if Next actually loads the middleware, and a
 * project with a `src` directory only looks for `src/middleware.ts`. A copy at
 * the repository root is ignored **silently** — no error, no warning — which is
 * how the guard shipped inert until the 2026-07-27 go-live drill hit
 * `/workspace` and got a 200. Reading the middleware source proves nothing;
 * only its location does.
 */
function assertMiddlewareIsInDiscoverableLocation() {
  const usesSrcDirectory = existsSync(path.join(process.cwd(), "src", "app"));

  assert.equal(
    usesSrcDirectory,
    true,
    "Expected an App Router project under src/."
  );
  assert.equal(
    existsSync(path.join(process.cwd(), "src", "middleware.ts")),
    true,
    "src/middleware.ts is missing: the workspace access guard would never run."
  );
  assert.equal(
    existsSync(path.join(process.cwd(), "middleware.ts")),
    false,
    "middleware.ts at the repository root is ignored when the app lives in src/. Move it to src/middleware.ts."
  );
}

/**
 * Every page under src/app must decide, in the source, whether it is rendered
 * per request.
 *
 * Why this is a deployment check and not a style preference: this project
 * serves its content out of the local store, and a page that does not declare
 * `dynamic` is prerendered by `next build` with `initialRevalidateSeconds`
 * false, so it never regenerates. That is not hypothetical — /skills,
 * /skills/[slug], /knowledge, /knowledge/[slug] and /network shipped that way
 * until 2026-08-18, which would have frozen every runtime skill and knowledge
 * edit at build time in production while /search (dynamic) still found the new
 * text and linked to a stale page.
 */
function assertPagesDeclareTheirRenderMode() {
  const appDirPath = path.join(process.cwd(), "src", "app");
  const appFilePaths = listFilesRecursive(appDirPath);
  const pageFilePaths = appFilePaths.filter(
    (filePath) => path.basename(filePath) === "page.tsx"
  );
  // Route handlers that export GET are the only ones Next can prerender; a
  // POST-only handler is dynamic by construction, so requiring a declaration
  // there would be 40+ cosmetic edits buying nothing.
  const getRouteFilePaths = appFilePaths.filter(
    (filePath) =>
      path.basename(filePath) === "route.ts" &&
      /export (async )?function GET/.test(readFileSync(filePath, "utf8"))
  );

  assert.ok(
    pageFilePaths.length > 0,
    "Expected to find page.tsx files under src/app."
  );

  const undeclared = [...pageFilePaths, ...getRouteFilePaths]
    .filter(
      (filePath) =>
        !readFileSync(filePath, "utf8").includes("export const dynamic")
    )
    .map((filePath) =>
      path.relative(process.cwd(), filePath).split(path.sep).join("/")
    );

  assert.deepEqual(
    undeclared,
    [],
    `These pages and GET route handlers do not declare "export const dynamic", so next build will prerender them and they will never pick up a content change: ${undeclared.join(", ")}`
  );
}

function buildHeaders(value: string): Headers {
  return new Headers({
    Authorization: value
  });
}

function assertNoInternalTerms(value: unknown, label: string) {
  const serializedValue =
    typeof value === "string" ? value : JSON.stringify(value);

  for (const term of internalOnlyTerms) {
    assert.equal(
      serializedValue.includes(term),
      false,
      `${label} should not include internal-only term ${term}.`
    );
  }
}

function readPackageScripts(): Record<string, string> {
  const parsedPackage = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  return parsedPackage.scripts ?? {};
}

function listFilesRecursive(rootPath: string): string[] {
  if (!existsSync(rootPath)) {
    return [];
  }

  const files: string[] = [];

  for (const itemName of readdirSync(rootPath)) {
    const itemPath = path.join(rootPath, itemName);
    const stat = statSync(itemPath);

    if (stat.isDirectory()) {
      files.push(...listFilesRecursive(itemPath));
    } else if (stat.isFile()) {
      files.push(itemPath);
    }
  }

  return files;
}

function assertClientBuildDoesNotContainWorkspaceSecret() {
  const staticDirPath = path.join(process.cwd(), ".next", "static");
  const secret = process.env.WORKSPACE_ACCESS_TOKEN?.trim();

  if (!existsSync(staticDirPath)) {
    return;
  }

  for (const filePath of listFilesRecursive(staticDirPath)) {
    const content = readFileSync(filePath, "utf8");

    assert.equal(
      content.includes("WORKSPACE_ACCESS_TOKEN"),
      false,
      "Client build should not include the workspace token environment variable name."
    );

    if (secret) {
      assert.equal(
        content.includes(secret),
        false,
        "Client build should not include the configured workspace token value."
      );
    }
  }
}

function assertPublicSourceDoesNotUseInternalTerms() {
  const publicPaths = [
    path.join(process.cwd(), "src", "app", "page.tsx"),
    path.join(process.cwd(), "src", "app", "technologies"),
    path.join(process.cwd(), "src", "app", "digest"),
    path.join(process.cwd(), "src", "app", "feed.xml"),
    path.join(process.cwd(), "src", "app", "feed.json"),
    path.join(process.cwd(), "src", "components", "daily-digest-content.tsx"),
    path.join(
      process.cwd(),
      "src",
      "components",
      "technology-detail-content.tsx"
    ),
    path.join(process.cwd(), "src", "components", "technology-list-card.tsx"),
    path.join(process.cwd(), "src", "components", "user-article-layout.tsx"),
    path.join(process.cwd(), "src", "components", "user-page-shell.tsx")
  ];
  const publicFiles = publicPaths.flatMap((publicPath) =>
    statSync(publicPath).isDirectory()
      ? listFilesRecursive(publicPath)
      : [publicPath]
  );

  for (const filePath of publicFiles) {
    const content = readFileSync(filePath, "utf8");

    for (const term of internalOnlyTerms) {
      assert.equal(
        content.includes(term),
        false,
        `${path.relative(process.cwd(), filePath)} should not reference internal-only term ${term}.`
      );
    }
  }
}

function assertLocalDataDirWritable() {
  const dataDirPath = getLocalDataDirPath();
  const probePath = path.join(dataDirPath, ".deployment-readiness-probe");

  mkdirSync(dataDirPath, { recursive: true });
  writeFileSync(probePath, "ok", "utf8");
  assert.equal(readFileSync(probePath, "utf8"), "ok");
  rmSync(probePath, { force: true });
}

function main() {
  const scripts = readPackageScripts();
  const validBearerHeaders = buildHeaders("Bearer deploy-secret");
  const invalidBearerHeaders = buildHeaders("Bearer wrong-secret");
  const validBasicHeaders = buildHeaders(
    `Basic ${Buffer.from("workspace:deploy-secret").toString("base64")}`
  );

  assert.equal(
    isWorkspaceAccessEnabled({ WORKSPACE_ACCESS_ENABLED: "true" }),
    true
  );
  assert.equal(
    isWorkspaceAccessEnabled({ WORKSPACE_ACCESS_ENABLED: "false" }),
    false
  );

  assert.equal(
    checkWorkspaceAccess(new Headers(), {
      WORKSPACE_ACCESS_ENABLED: "false",
      WORKSPACE_ACCESS_TOKEN: ""
    }).authorized,
    true,
    "Disabled workspace access should not block local development."
  );
  assert.equal(
    checkWorkspaceAccess(new Headers(), {
      WORKSPACE_ACCESS_ENABLED: "true",
      WORKSPACE_ACCESS_TOKEN: ""
    }).configured,
    false,
    "Enabled workspace access requires a configured token."
  );
  assert.equal(
    checkWorkspaceAccess(validBearerHeaders, {
      WORKSPACE_ACCESS_ENABLED: "true",
      WORKSPACE_ACCESS_TOKEN: "deploy-secret"
    }).authorized,
    true,
    "Bearer workspace token should authorize internal routes."
  );
  assert.equal(
    checkWorkspaceAccess(validBasicHeaders, {
      WORKSPACE_ACCESS_ENABLED: "true",
      WORKSPACE_ACCESS_TOKEN: "deploy-secret"
    }).authorized,
    true,
    "Basic auth password should authorize internal routes."
  );
  assert.equal(
    checkWorkspaceAccess(invalidBearerHeaders, {
      WORKSPACE_ACCESS_ENABLED: "true",
      WORKSPACE_ACCESS_TOKEN: "deploy-secret"
    }).authorized,
    false,
    "Invalid workspace token should be rejected."
  );

  for (const route of [
    "/workspace",
    "/workspace/sources",
    "/api/workspace/delivery/send",
    "/api/candidates/example/status",
    "/candidates/example",
    "/technologies/drafts/example"
  ]) {
    assert.equal(
      isProtectedWorkspacePath(route),
      true,
      `${route} should be protected.`
    );
  }

  for (const route of [
    "/",
    "/technologies",
    "/technologies/model-context-protocol",
    "/digest/today",
    "/digest/2026-05-23",
    "/feed.xml",
    "/feed.json"
  ]) {
    assert.equal(
      isProtectedWorkspacePath(route),
      false,
      `${route} should stay public.`
    );
  }

  for (const scriptName of [
    "tasks:run-once",
    "tasks:watch",
    "validate:deployment"
  ]) {
    assert.ok(scripts[scriptName], `${scriptName} script should exist.`);
  }

  assertLocalDataDirWritable();

  const maskedEndpoint = maskEndpointUrl(
    "https://open.feishu.cn/open-apis/bot/v2/hook/abc?token=super-secret&signature=sig"
  );

  assert.equal(maskedEndpoint.includes("super-secret"), false);
  assert.equal(maskedEndpoint.includes("signature=sig"), false);
  assert.equal(
    maskEndpointUrl("mock://failed?token=super-secret").includes(
      "super-secret"
    ),
    false
  );

  assertNoInternalTerms(renderDigestJsonFeed(), "Public JSON feed");
  assertNoInternalTerms(renderDigestRssXml(), "Public RSS feed");
  assertPublicSourceDoesNotUseInternalTerms();
  assertClientBuildDoesNotContainWorkspaceSecret();
  assertMiddlewareIsInDiscoverableLocation();
  assertPagesDeclareTheirRenderMode();

  console.log("Deployment readiness validation passed.");
}

main();
