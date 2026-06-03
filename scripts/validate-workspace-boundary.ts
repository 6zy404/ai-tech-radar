import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function listFilesRecursive(relativePath: string): string[] {
  const absolutePath = path.join(root, relativePath);

  if (!existsSync(absolutePath)) {
    return [];
  }

  const stat = statSync(absolutePath);

  if (stat.isFile()) {
    return [absolutePath];
  }

  return readdirSync(absolutePath).flatMap((itemName) =>
    listFilesRecursive(path.join(relativePath, itemName))
  );
}

function assertContains(content: string, expected: string, label: string) {
  assert.ok(content.includes(expected), `${label} should contain "${expected}".`);
}

function assertDoesNotContain(content: string, forbidden: string, label: string) {
  assert.equal(
    content.includes(forbidden),
    false,
    `${label} should not contain "${forbidden}".`
  );
}

function main() {
  const topNav = read("src/components/top-nav.tsx");
  const workspaceShell = read("src/components/workspace-page-shell.tsx");
  const workspaceDashboard = read("src/app/workspace/page.tsx");
  const workspaceActionsDoc = read("docs/workspace-actions.md");
  const packageJson = JSON.parse(read("package.json")) as {
    scripts?: Record<string, string>;
  };

  assertContains(topNav, "Internal Workspace", "Top navigation");
  assertContains(
    workspaceShell,
    "Internal editorial workspace.",
    "Workspace boundary note"
  );
  assertContains(
    workspaceDashboard,
    "Internal Editorial Workspace",
    "Workspace dashboard"
  );
  assertContains(
    workspaceDashboard,
    "Turn external technology signals into reviewed public content.",
    "Workspace dashboard"
  );

  for (const actionType of [
    "Primary action",
    "Secondary action",
    "Destructive action",
    "Status action",
    "Diagnostic action"
  ]) {
    assertContains(workspaceActionsDoc, actionType, "Workspace action doc");
  }

  for (const label of [
    "Run source import",
    "Save draft edits",
    "Generate digest draft",
    "Publish digest",
    "Send to selected channel",
    "Mark candidate as reviewed",
    "Reject candidate",
    "Convert to technology draft",
    "Apply selected suggestion fields",
    "Regenerate enrichment suggestion"
  ]) {
    assertContains(workspaceActionsDoc, label, "Workspace action doc");
  }

  assert.ok(
    packageJson.scripts?.["validate:workspace-boundary"],
    "validate:workspace-boundary script should exist."
  );

  const actionFiles = [
    "src/components/external-source-actions.tsx",
    "src/components/imported-candidate-review-actions.tsx",
    "src/components/technology-workspace-actions.tsx",
    "src/components/daily-digest-workspace-actions.tsx",
    "src/components/digest-delivery-actions.tsx",
    "src/components/delivery-channel-actions.tsx",
    "src/components/scheduled-delivery-actions.tsx",
    "src/components/delivery-run-actions.tsx",
    "src/components/daily-digest-editor-actions.tsx",
    "src/components/technology-editorial-enrichment-panel.tsx"
  ].map(read);

  const combinedActions = actionFiles.join("\n");

  for (const expected of [
    "window.confirm",
    "Run source import",
    "Disable source",
    "Reject candidate",
    "Archive technology",
    "Generate digest draft",
    "Archive digest",
    "Send to selected channel",
    "Disable channel",
    "Run schedule now",
    "Run due schedules now",
    "Retry failed delivery",
    "Exclude from digest",
    "Apply selected suggestion fields"
  ]) {
    assertContains(combinedActions, expected, "Workspace action components");
  }

  const publicFiles = [
    ...listFilesRecursive("src/app/technologies"),
    ...listFilesRecursive("src/app/digest"),
    ...listFilesRecursive("src/app/skills"),
    ...listFilesRecursive("src/app/knowledge"),
    path.join(root, "src/app/page.tsx")
  ];
  const forbiddenWorkspaceImports = [
    "WorkspacePageShell",
    "WorkspaceNav",
    "ImportedCandidateReviewActions",
    "ExternalSourceActions",
    "TechnologyWorkspaceActions",
    "DigestDeliveryActions",
    "DeliveryChannelActions",
    "ScheduledDeliveryActions",
    "DeliveryRunActions",
    "TechnologyEditorialEnrichmentPanel"
  ];

  for (const filePath of publicFiles) {
    const content = readFileSync(filePath, "utf8");
    const label = path.relative(root, filePath);

    for (const forbidden of forbiddenWorkspaceImports) {
      assertDoesNotContain(content, forbidden, label);
    }
  }

  const uiCheck = read("scripts/playwright-ui-check.mjs");
  assertContains(uiCheck, "hasFailedStylesheet", "Playwright UI check script");
  assertContains(uiCheck, "internalTermHits", "Playwright UI check script");
  assertContains(uiCheck, "workspaceShell", "Playwright UI check script");
  assertContains(uiCheck, "userShell", "Playwright UI check script");

  console.log("Workspace boundary and action clarity validation passed.");
}

main();
