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

  console.log("Deployment readiness validation passed.");
}

main();
