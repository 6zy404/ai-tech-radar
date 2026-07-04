import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = "http://127.0.0.1:3000";
// This script is intended to run in the user's local PowerShell session.
// Chromium can fail with spawn EPERM inside the Codex sandbox; treat that as
// manual validation pending rather than a project failure.
const outputDir = path.resolve("visual-qa-screenshots");
const resultPath = path.join(outputDir, "ui-check-results.json");
const localDataDir = path.resolve(process.env.LOCAL_DATA_DIR ?? "config");
const workspaceToken = process.env.WORKSPACE_ACCESS_TOKEN?.trim();
const internalTerms = [
  "rawPayload",
  "importStatus",
  "normalizedType",
  "duplicateGroupId",
  "reviewedAt",
  "convertedTechnologyId",
  "qualityFlags",
  "candidateQuality",
  "sourceQuality",
  "priorityScore",
  "editorialNotes",
  "manuallyAddedTechnologyIds",
  "excludedTechnologyIds",
  "pinnedTechnologyIds",
  "orderedTechnologyIds",
  "endpointUrl",
  "channelType",
  "DeliveryChannel",
  "DeliveryRun",
  "ScheduledDelivery",
  "ScheduledDeliveryRun",
  "TaskRunner",
  "WorkflowEvent",
  "AuditLog",
  "EditorialEnrichmentSuggestion",
  "generationMode",
  "providerName",
  "modelName",
  "promptVersion",
  "promptVersionId",
  "tokenUsage",
  "generationError",
  "reviewStatus",
  "qualityScore",
  "qualityLabels",
  "rejectionReason",
  "appliedFields",
  "PromptVersion",
  "LLM_API_KEY",
  "LLM_PROVIDER",
  "sourceInputs",
  "reviewerNotes",
  "ai_assisted_placeholder",
  "rule_based",
  "workflow-events.json",
  "audit log",
  "delivery log",
  "task-runner",
  "tasks:run-once",
  "tasks:watch",
  "WORKSPACE_ACCESS_TOKEN",
  "workspace access token",
  "scheduleTime",
  "channelIds",
  "deliveryLogIds",
  "lastRunStatus",
  "lastRunMessage",
  "requestPayloadPreview",
  "responseBodyPreview",
  "retryOfDeliveryRunId"
];

async function readDailyDigests() {
  try {
    const raw = await readFile(
      path.join(localDataDir, "daily-digests.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed.digests) ? parsed.digests : [];
  } catch {
    return [];
  }
}

async function readTechnologyWorkspaceRecords() {
  try {
    const raw = await readFile(
      path.join(localDataDir, "technology-workspace.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch {
    return [];
  }
}

const digests = await readDailyDigests();
const workspaceTechnologyRecords = await readTechnologyWorkspaceRecords();
const latestPublishedDigest = digests
  .filter((digest) => digest.status === "published")
  .sort((left, right) =>
    String(right.date).localeCompare(String(left.date))
  )[0];
const latestWorkspaceDigest = digests.sort((left, right) =>
  String(right.date).localeCompare(String(left.date))
)[0];
const latestWorkspaceTechnology = workspaceTechnologyRecords.sort(
  (left, right) =>
    String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? ""))
)[0];

const pages = [
  { name: "workspace-overview", route: "/workspace", kind: "workspace" },
  {
    name: "workspace-candidates",
    route: "/workspace/candidates",
    kind: "workspace"
  },
  {
    name: "workspace-duplicates",
    route: "/workspace/duplicates",
    kind: "workspace"
  },
  {
    name: "workspace-technologies",
    route: "/workspace/technologies",
    kind: "workspace"
  },
  ...(latestWorkspaceTechnology
    ? [
        {
          name: "workspace-technology-detail",
          route: `/workspace/technologies/${latestWorkspaceTechnology.id}`,
          kind: "workspace"
        }
      ]
    : []),
  { name: "workspace-sources", route: "/workspace/sources", kind: "workspace" },
  { name: "workspace-digests", route: "/workspace/digests", kind: "workspace" },
  {
    name: "workspace-delivery",
    route: "/workspace/delivery",
    kind: "workspace"
  },
  {
    name: "workspace-operations",
    route: "/workspace/operations",
    kind: "workspace"
  },
  {
    name: "workspace-operations-events",
    route: "/workspace/operations/events",
    kind: "workspace"
  },
  {
    name: "workspace-delivery-schedules",
    route: "/workspace/delivery/schedules",
    kind: "workspace"
  },
  ...(latestWorkspaceDigest
    ? [
        {
          name: "workspace-digest-detail",
          route: `/workspace/digests/${latestWorkspaceDigest.date}`,
          kind: "workspace"
        }
      ]
    : []),
  { name: "home", route: "/", kind: "user" },
  { name: "technologies", route: "/technologies", kind: "user" },
  {
    name: "technology-detail",
    route: "/technologies/model-context-protocol",
    kind: "user"
  },
  { name: "digest-today", route: "/digest/today", kind: "user" },
  { name: "feed-json", route: "/feed.json", kind: "feed" },
  { name: "feed-xml", route: "/feed.xml", kind: "feed" },
  ...(latestPublishedDigest
    ? [
        {
          name: "digest-date",
          route: `/digest/${latestPublishedDigest.date}`,
          kind: "user"
        }
      ]
    : []),
  { name: "skills", route: "/skills", kind: "user" },
  {
    name: "skill-detail",
    route: "/skills/agent-workflow-design",
    kind: "user"
  },
  { name: "knowledge", route: "/knowledge", kind: "user" },
  {
    name: "knowledge-detail",
    route: "/knowledge/api-contracts-and-interface-boundaries",
    kind: "user"
  }
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  extraHTTPHeaders: workspaceToken
    ? {
        Authorization: `Bearer ${workspaceToken}`
      }
    : {}
});

const results = [];

for (const target of pages) {
  const page = await context.newPage();
  const stylesheetResponses = [];

  page.on("response", (response) => {
    const url = response.url();
    if (url.includes(".css")) {
      stylesheetResponses.push({
        url,
        status: response.status()
      });
    }
  });

  const response = await page.goto(`${baseUrl}${target.route}`, {
    waitUntil: "networkidle",
    timeout: 30000
  });

  const status = response?.status() ?? 0;
  const title = await page.title();
  const screenshotPath = path.join(outputDir, `${target.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const metrics = await page.evaluate((terms) => {
    const bodyText = document.body.innerText;
    const bodyRect = document.body.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const allElements = Array.from(document.querySelectorAll("*"));
    const overflowingElements = allElements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.right > viewportWidth + 2;
      })
      .slice(0, 8)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: String(element.getAttribute("class") ?? ""),
          text: String(element.textContent ?? "")
            .trim()
            .slice(0, 90),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      });

    const main = document.querySelector(
      ".user-article-layout__main, .detail-main, .candidate-review-main, main"
    );
    const aside = document.querySelector(
      ".user-article-layout__aside, .detail-side, .candidate-review-aside, aside"
    );
    const mainRect = main?.getBoundingClientRect();
    const asideRect = aside?.getBoundingClientRect();
    const bodyStyle = window.getComputedStyle(document.body);
    const navStyle = window.getComputedStyle(
      document.querySelector(".top-nav") ?? document.body
    );
    const buttons = Array.from(
      document.querySelectorAll("button, a.action-link, .action-button")
    )
      .map((element) => String(element.textContent ?? "").trim())
      .filter(Boolean)
      .slice(0, 12);

    return {
      bodyHeight: Math.round(bodyRect.height),
      viewportWidth,
      viewportHeight,
      horizontalOverflow:
        document.documentElement.scrollWidth > viewportWidth + 2,
      overflowingElements,
      internalTermHits: terms.filter((term) => bodyText.includes(term)),
      workspaceShell: Boolean(document.querySelector(".workspace-shell")),
      workspaceNav: Boolean(document.querySelector(".workspace-nav")),
      workspaceBreadcrumbs: Boolean(
        document.querySelector(".workspace-breadcrumbs")
      ),
      userShell: Boolean(document.querySelector(".user-shell")),
      cardCount: document.querySelectorAll(
        "article, .detail-panel, .section-panel"
      ).length,
      mainWidth: mainRect ? Math.round(mainRect.width) : null,
      asideWidth: asideRect ? Math.round(asideRect.width) : null,
      bodyFontFamily: bodyStyle.fontFamily,
      topNavPosition: navStyle.position,
      cssLinks: Array.from(
        document.querySelectorAll('link[rel="stylesheet"]')
      ).map((link) => link.href),
      buttons
    };
  }, internalTerms);

  results.push({
    ...target,
    url: `${baseUrl}${target.route}`,
    status,
    title,
    screenshotPath,
    stylesheetResponses,
    hasFailedStylesheet: stylesheetResponses.some(
      (stylesheet) => stylesheet.status >= 400
    ),
    metrics
  });

  await page.close();
}

await browser.close();

const output = JSON.stringify(results, null, 2);
await writeFile(resultPath, `${output}\n`, "utf8");

console.log(output);
console.log(`Saved results to ${resultPath}`);
