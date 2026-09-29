// Repairs HTML and HTML entities that the importers stored before 2026-09-29.
//
//   node scripts/run-ts.cjs scripts/repair-entities.ts                 # dry run
//   node scripts/run-ts.cjs scripts/repair-entities.ts --apply         # write
//   ... --published-text   also clean published title/summary/content
//                          (original + en) that carry HTML — opt-in
//
// What it touches (only fields that visibly carry markup, and only when
// cleaning changes them, so a second run reports nothing):
//   imported-candidates.live.json  sourceUrl, originalTitle,
//                                  originalSummary, originalContent
//   technology-workspace.json      sourceUrl, sourceReferences[].sourceUrl
//                                  (+ localized text with --published-text)
// Candidate ids, rawPayload and the workflow-event history are never changed.
// Rules: src/lib/entity-repair.ts.
import {
  planCandidateSnapshotRepair,
  planTechnologyRecordsRepair,
  type EntityRepairChange
} from "../src/lib/entity-repair";
import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "../src/lib/repositories/local-json-store";
import type {
  ImportedCandidateSnapshot,
  TechnologyWorkspaceRecord
} from "../src/types/content";

const args = new Set(process.argv.slice(3));
const apply = args.has("--apply");
const publishedText = args.has("--published-text");
const verbose = args.has("--verbose");

function preview(value: string): string {
  const flat = value.replace(/\s+/g, " ");

  return verbose || flat.length <= 110 ? flat : `${flat.slice(0, 107)}...`;
}

function report(changes: EntityRepairChange[]): void {
  const byField = new Map<string, number>();

  for (const change of changes) {
    const field = change.field.replace(/\[\d+\]/, "[]");

    byField.set(field, (byField.get(field) ?? 0) + 1);
    console.log(`  ${change.id} · ${change.field}`);
    console.log(`    - ${preview(change.before)}`);
    console.log(`    + ${preview(change.after) || "（空）"}`);
  }

  for (const [field, count] of byField) {
    console.log(`  小计 ${field}: ${count}`);
  }
}

const candidatePath = getLocalStoreFilePath("imported-candidates.live.json");
const technologyPath = getLocalStoreFilePath("technology-workspace.json");

const snapshot = readLocalJsonFile<ImportedCandidateSnapshot | null>(
  candidatePath,
  null
);
const technologyStore = readLocalJsonFile<{
  updatedAt?: string;
  records: TechnologyWorkspaceRecord[];
} | null>(technologyPath, null);

const candidatePlan = snapshot
  ? planCandidateSnapshotRepair(snapshot)
  : undefined;
const technologyPlan = technologyStore
  ? planTechnologyRecordsRepair(technologyStore.records, { publishedText })
  : undefined;

console.log(
  `模式：${apply ? "写入（--apply）" : "只读预演（dry run，加 --apply 才写入）"}` +
    `${publishedText ? "，含已发布正文（--published-text）" : ""}`
);

console.log(
  `\n候选池 ${candidatePath}：${snapshot ? `${snapshot.candidates.length} 条候选，${new Set(candidatePlan?.changes.map((c) => c.id)).size} 条要改，${candidatePlan?.changes.length ?? 0} 个字段` : "文件不存在，跳过"}`
);
if (candidatePlan?.changes.length) {
  report(candidatePlan.changes);
}

console.log(
  `\n技术信号 ${technologyPath}：${technologyStore ? `${technologyStore.records.length} 条记录，${new Set(technologyPlan?.changes.map((c) => c.id)).size} 条要改，${technologyPlan?.changes.length ?? 0} 个字段` : "文件不存在，跳过"}`
);
if (technologyPlan?.changes.length) {
  report(technologyPlan.changes);
}

const total =
  (candidatePlan?.changes.length ?? 0) + (technologyPlan?.changes.length ?? 0);

if (!apply) {
  console.log(`\n共 ${total} 个字段待修。未写入任何文件。`);
} else if (total === 0) {
  console.log("\n没有需要修的字段，未写入任何文件。");
} else {
  if (snapshot && candidatePlan?.changes.length) {
    writeLocalJsonFile(candidatePath, candidatePlan.next);
  }

  if (technologyStore && technologyPlan?.changes.length) {
    writeLocalJsonFile(technologyPath, {
      ...technologyStore,
      records: technologyPlan.next
    });
  }

  console.log(`\n已写入，共修 ${total} 个字段。再跑一次应报告 0。`);
}
