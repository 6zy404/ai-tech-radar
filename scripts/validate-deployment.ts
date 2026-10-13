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

import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";

import {
  config as middlewareConfig,
  middleware
} from "../src/middleware";
import {
  renderDigestJsonFeed,
  renderDigestRssXml
} from "../src/lib/digest-delivery";
import { getAllTechnologies } from "../src/lib/content";
import { maskEndpointUrl } from "../src/lib/delivery-workflow";
import { getLocalDataDirPath } from "../src/lib/local-data";
import { signalVectorEntryKeys } from "../src/lib/local-recommend";
import {
  buildSignalVectorFile,
  toPublishedSignalCard
} from "../src/lib/local-recommend-vectors";
import {
  declaresRenderMode,
  findUndeclaredMetadataRoutes,
  isGeneratedMetadataRoute,
  mustDeclareRenderMode
} from "../src/lib/metadata-route-render-mode";
import { buildSignalPathMap } from "../src/lib/pwa-signal-paths";
import { getPublicRadar } from "../src/lib/radar";
import { createRadarWorkspaceRecord } from "../src/lib/radar-workflow";
import {
  checkWorkspaceAccess,
  isProtectedWorkspacePath,
  isWorkspaceAccessEnabled,
  protectedPathPrefixes
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
    .filter((filePath) => !declaresRenderMode(readFileSync(filePath, "utf8")))
    .map((filePath) =>
      path.relative(process.cwd(), filePath).split(path.sep).join("/")
    );

  assert.deepEqual(
    undeclared,
    [],
    `These pages and GET route handlers do not declare "export const dynamic", so next build will prerender them and they will never pick up a content change: ${undeclared.join(", ")}`
  );
}

/**
 * The same decision for generated metadata routes — share images, icons, the
 * sitemap. `/digest/today/opengraph-image` was prerendered and froze on the
 * build day's issue until 2026-09-30 because the check above only read
 * `page.tsx`. The rule itself (which routes need it, and why a route under
 * `[slug]` usually does not) lives in `src/lib/metadata-route-render-mode.ts`.
 */
function assertMetadataRoutesDeclareTheirRenderMode() {
  const files = listFilesRecursive(path.join(process.cwd(), "src", "app")).map(
    (filePath) => ({
      path: path.relative(process.cwd(), filePath).split(path.sep).join("/"),
      source: readFileSync(filePath, "utf8")
    })
  );
  const metadataRoutes = files.filter((file) =>
    isGeneratedMetadataRoute(file.path)
  );

  // Guards against the check going vacuous, e.g. after a directory move.
  assert.ok(
    metadataRoutes.some((file) => mustDeclareRenderMode(file)),
    "Expected at least one generated metadata route under src/app that must declare its render mode."
  );

  const undeclared = findUndeclaredMetadataRoutes(metadataRoutes);

  assert.deepEqual(
    undeclared,
    [],
    `These metadata routes have no dynamic segment (or list their params with generateStaticParams) but do not declare "export const dynamic", so next build will prerender them and freeze them on the build day: ${undeclared.join(", ")}`
  );
}

/**
 * The public build removes the directories that produce the workspace routes
 * (`scripts/build-public.mjs`), and the request-time guard blocks the same
 * prefixes (`src/middleware.ts`, via `protectedPathPrefixes`). Those two lists
 * are written in different files, in different languages, and nothing makes
 * them agree — so a prefix added to the guard but not to the build script would
 * ship to the public site with only the guard in front of it, which is exactly
 * the single-lock situation the build exclusion exists to remove.
 *
 * This is a source-text check on purpose: it runs without a build, so it fails
 * at the moment the drift is introduced rather than at the next deploy.
 */
function assertPublicBuildExcludesEveryGuardedPrefix() {
  const scriptPath = path.join(process.cwd(), "scripts", "build-public.mjs");

  assert.ok(
    existsSync(scriptPath),
    "scripts/build-public.mjs should exist; it is what keeps workspace routes out of the public build."
  );

  const source = readFileSync(scriptPath, "utf8");
  const excludedBlock = source.match(/const EXCLUDED = \[([\s\S]*?)\];/);

  assert.ok(
    excludedBlock,
    "Could not find the EXCLUDED array in scripts/build-public.mjs."
  );

  const excludedDirs = [...excludedBlock[1].matchAll(/"([^"]+)"/g)].map(
    (match) => match[1]
  );

  assert.ok(
    excludedDirs.length > 0,
    "The EXCLUDED array in scripts/build-public.mjs is empty."
  );

  // "src/app/api/workspace" is what produces "/api/workspace".
  const excludedPrefixes = excludedDirs.map((dir) =>
    dir.replace(/^src\/app/, "")
  );

  const uncovered = protectedPathPrefixes.filter(
    (prefix) => !excludedPrefixes.includes(prefix)
  );

  assert.deepEqual(
    uncovered,
    [],
    `These prefixes are guarded by src/middleware.ts but their directories are not excluded from the public build, so they would ship: ${uncovered.join(", ")}. Add them to EXCLUDED in scripts/build-public.mjs.`
  );

  // Every excluded directory must actually exist, or the exclusion is a
  // no-op that reads as protection.
  const missing = excludedDirs.filter(
    (dir) => !existsSync(path.join(process.cwd(), dir))
  );

  assert.deepEqual(
    missing,
    [],
    `scripts/build-public.mjs excludes directories that do not exist, so the exclusion proves nothing: ${missing.join(", ")}`
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

// /signal-vectors.json, the recommendation data file, lists published
// signals only, and every entry has exactly the fixed key set — a hashed key,
// the public card fields and the vector. A corpus document whose id is not a
// published signal (an archived record, a skill) is left out, and the long
// workspace ids never appear. Built from synthetic vectors, so the check needs
// no model.
function assertSignalVectorsCarryOnlyPublishedSignals() {
  const allowedKeys = [
    "key",
    "priorityLabel",
    "publishDate",
    "scale",
    "slug",
    "summary",
    "tagIds",
    "title",
    "vector"
  ];
  const published = getAllTechnologies().slice(0, 3);
  const vector = (seed: number) =>
    Array.from({ length: 8 }, (_, index) => Math.sin(seed + index));
  const document = (key: string, group: "technologies" | "skills") => ({
    group,
    evalKey: key,
    link: { key, title: key, href: "/", tags: [] },
    titleText: key,
    haystack: key,
    embedText: key
  });
  const file = buildSignalVectorFile(
    {
      documents: [
        ...published.map((technology) =>
          document(technology.id, "technologies")
        ),
        document("deployment-validation-unpublished", "technologies"),
        document("deployment-validation-skill", "skills")
      ],
      vectors: Array.from({ length: published.length + 2 }, (_, index) =>
        vector(index)
      )
    },
    published.map(toPublishedSignalCard),
    "validation-model"
  );

  assert.deepEqual(
    [...signalVectorEntryKeys],
    allowedKeys,
    "The recommendation data file's key list changed; review what it ships."
  );
  assert.deepEqual(
    file.signals.map((signal) => signal.slug),
    published.map((technology) => technology.slug),
    "/signal-vectors.json must list published signals only."
  );

  for (const signal of file.signals) {
    assert.deepEqual(
      Object.keys(signal).sort(),
      allowedKeys,
      "/signal-vectors.json entries carry only the allowed keys."
    );
  }

  const serialized = JSON.stringify(file);

  // An id that is part of its own slug is public anyway; the check is for
  // the long workspace ids, which are not.
  for (const technology of published.filter(
    (item) => !item.slug.includes(item.id)
  )) {
    assert.equal(
      serialized.includes(technology.id),
      false,
      "/signal-vectors.json must not carry raw signal ids."
    );
  }

  assertNoInternalTerms(file, "/signal-vectors.json");
}

// /pwa/signal-paths.json lets the service worker find the pages saved for
// 稍后读. It lists published signals only, keyed by hash: no raw id, and every
// value is a public signal path.
function assertSignalPathsCarryNoRawIds() {
  const published = getAllTechnologies();
  const paths = buildSignalPathMap([
    ...published,
    { id: "deployment-validation-draft", slug: "draft-only", status: "draft" }
  ]);
  const values = Object.values(paths);

  assert.equal(
    values.length,
    published.length,
    "/pwa/signal-paths.json must list published signals only."
  );
  assert.ok(
    values.every((value) => /^\/technologies\/[^/]+$/.test(value)),
    "/pwa/signal-paths.json values must be public signal paths."
  );

  const serialized = JSON.stringify(paths);

  for (const technology of published.filter(
    (item) => !item.slug.includes(item.id)
  )) {
    assert.equal(
      serialized.includes(technology.id),
      false,
      "/pwa/signal-paths.json must not carry raw signal ids."
    );
  }

  assertNoInternalTerms(paths, "/pwa/signal-paths.json");
}

// /radar renders only what toPublicRadarEntries picks: a workspace draft
// never shows, and no entry carries workspace status, timestamps or raw ids.
// Writes one draft into the validator's throwaway data copy.
function assertRadarPublishesOnlyPublicFields() {
  const allowedKeys = new Set([
    "number",
    "name",
    "slug",
    "quadrant",
    "ring",
    "ringReason",
    "change",
    "movedFrom",
    "evidence",
    "knowledge",
    "skills",
    "history"
  ]);
  const before = getPublicRadar();

  assert.ok(
    before.entries.length > 0,
    "The seed radar should publish entries."
  );

  for (const entry of before.entries) {
    for (const key of Object.keys(entry)) {
      assert.ok(allowedKeys.has(key), `/radar entry carries "${key}".`);
    }
  }

  const evidenceId = getAllTechnologies()[0]?.id;
  assert.ok(evidenceId, "A published signal is needed as evidence.");

  createRadarWorkspaceRecord({
    name: "部署校验草稿条目",
    slug: "deployment-validation-draft",
    quadrant: "tools-methods",
    ring: "assess",
    ringReason: "只用于校验草稿不出现在公开页。",
    evidenceTechnologyIds: [evidenceId]
  });

  assert.equal(
    getPublicRadar().entries.some(
      (entry) => entry.slug === "deployment-validation-draft"
    ),
    false,
    "A draft radar entry must not appear on /radar."
  );
}

function assertPublicSourceDoesNotUseInternalTerms() {
  const publicPaths = [
    path.join(process.cwd(), "src", "app", "page.tsx"),
    path.join(process.cwd(), "src", "app", "technologies"),
    path.join(process.cwd(), "src", "app", "digest"),
    path.join(process.cwd(), "src", "app", "sources"),
    path.join(process.cwd(), "src", "app", "radar"),
    path.join(process.cwd(), "src", "components", "radar-view.tsx"),
    path.join(process.cwd(), "src", "lib", "radar.ts"),
    path.join(process.cwd(), "src", "app", "feed.xml"),
    path.join(process.cwd(), "src", "app", "feed.json"),
    path.join(process.cwd(), "src", "app", "signal-vectors.json"),
    path.join(process.cwd(), "src", "lib", "local-recommend.ts"),
    path.join(process.cwd(), "src", "lib", "local-recommend-vectors.ts"),
    path.join(process.cwd(), "src", "components", "home-recommend-section.tsx"),
    path.join(process.cwd(), "src", "components", "saved-recommendations.tsx"),
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

/**
 * Since the English interface (2026-10-13) the middleware runs on every page
 * to set the locale header, not only on the five protected prefixes, and its
 * last matcher entry skips files with an extension. Two things must survive
 * that widening, checked with Next's own matcher rather than a re-implemented
 * one:
 *
 * - every protected prefix — bare, nested, and with an extension that the
 *   locale entry skips — still reaches the middleware, and the middleware
 *   still answers 503 when protection is on without a token and 401 without
 *   credentials;
 * - none of the five has an `/en` twin: `src/app/en` holds no directory
 *   that would produce `/en/workspace` and the rest.
 */
function assertMiddlewareStillGuardsEveryProtectedPrefix() {
  const samples = protectedPathPrefixes.flatMap((prefix) => [
    prefix,
    `${prefix}/anything`,
    `${prefix}/anything.json`
  ]);

  for (const pathname of samples) {
    assert.ok(
      unstable_doesMiddlewareMatch({
        config: middlewareConfig,
        url: `http://localhost${pathname}`
      }),
      `src/middleware.ts no longer runs on ${pathname}; the workspace guard would not see it.`
    );
  }

  const savedEnv = {
    enabled: process.env.WORKSPACE_ACCESS_ENABLED,
    token: process.env.WORKSPACE_ACCESS_TOKEN
  };
  const restoreEnv = () => {
    for (const [key, value] of [
      ["WORKSPACE_ACCESS_ENABLED", savedEnv.enabled],
      ["WORKSPACE_ACCESS_TOKEN", savedEnv.token]
    ] as const) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  try {
    process.env.WORKSPACE_ACCESS_ENABLED = "true";

    for (const [token, expected] of [
      ["", 503],
      ["deploy-secret", 401]
    ] as const) {
      process.env.WORKSPACE_ACCESS_TOKEN = token;

      for (const pathname of samples) {
        const response = middleware(
          new NextRequest(`http://localhost${pathname}`)
        );
        assert.equal(
          response.status,
          expected,
          `${pathname} answered ${response.status} with protection on and ${token ? "no credentials" : "no token configured"}; expected ${expected}.`
        );
      }
    }
  } finally {
    restoreEnv();
  }

  const englishTwins = protectedPathPrefixes
    .map((prefix) => path.join(process.cwd(), "src", "app", "en", prefix))
    .filter((dir) => existsSync(dir));

  assert.deepEqual(
    englishTwins,
    [],
    `These directories would give a protected prefix an /en address: ${englishTwins.join(", ")}`
  );
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
    "/workspace/radar",
    "/workspace/radar/radar-vllm",
    "/api/workspace/radar",
    "/api/workspace/radar/radar-vllm/status",
    "/api/workspace/delivery/send",
    // 推送新信号 (2026-10-13): the send button is workspace-only.
    "/api/workspace/push",
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
    "/sources",
    "/about",
    "/radar",
    "/feed.xml",
    "/feed.json",
    "/signal-vectors.json",
    // PWA + reader push (2026-10-13): the installable shell and the reader's
    // own subscribe calls must work without a workspace token.
    "/offline",
    "/sw.js",
    "/manifest.webmanifest",
    "/pwa/signal-paths.json",
    "/api/push/config",
    "/api/push/subscribe",
    "/api/push/unsubscribe"
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
  assertMiddlewareStillGuardsEveryProtectedPrefix();
  assertPagesDeclareTheirRenderMode();
  assertMetadataRoutesDeclareTheirRenderMode();
  assertPublicBuildExcludesEveryGuardedPrefix();
  assertRadarPublishesOnlyPublicFields();
  assertSignalVectorsCarryOnlyPublishedSignals();
  assertSignalPathsCarryNoRawIds();

  console.log("Deployment readiness validation passed.");
}

main();
