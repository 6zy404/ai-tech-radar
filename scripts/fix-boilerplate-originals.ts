// One-off: replaces InfoQ's 「点击查看原文>」 link where a signal's original
// summary or body should be.
//
//   node scripts/run-ts.cjs scripts/fix-boilerplate-originals.ts           # dry run
//   node scripts/run-ts.cjs scripts/fix-boilerplate-originals.ts --apply   # write
//
// Signals converted from a link-only InfoQ 中文 item kept the feed description
// as `summary.original` / `content.original` — the right-aligned link and
// nothing else — while an editor wrote the real `zh` text. The 原文 reading
// mode shows `original` without falling back, so it printed that one line, and
// keyword search indexed it. Measured 2026-09-30: 8 published signals, 13
// fields (8 bodies, 5 summaries). `repair-entities.ts --published-text`
// deliberately skipped them because cleaning would have left them empty.
//
// A field is changed only when, once its HTML is removed, it is feed
// boilerplate and nothing else; it then takes the `zh` text (these sources are
// Chinese — there is no other original). Titles, fields with real original
// text and fields with an empty `zh` are left alone, so a second run finds
// nothing. Only `technology-workspace.json` (or LOCAL_DATA_DIR's copy) is
// written. Rules: src/lib/boilerplate-original-repair.ts.
import { planBoilerplateOriginalRepair } from "../src/lib/boilerplate-original-repair";
import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "../src/lib/repositories/local-json-store";
import type { TechnologyWorkspaceRecord } from "../src/types/content";

const apply = process.argv.slice(3).includes("--apply");
const storePath = getLocalStoreFilePath("technology-workspace.json");

console.log(`数据文件：${storePath}`);
console.log(
  `模式：${apply ? "写入（--apply）" : "只读预演（dry run，加 --apply 才写入）"}`
);

const store = readLocalJsonFile<{
  updatedAt?: string;
  records: TechnologyWorkspaceRecord[];
} | null>(storePath, null);

if (!store) {
  console.log("文件不存在，无事可做。");
  process.exit(0);
}

function preview(value: string): string {
  const flat = value.replace(/\s+/g, " ");

  return flat.length <= 90 ? flat : `${flat.slice(0, 87)}...`;
}

const { next, changes, skipped } = planBoilerplateOriginalRepair(store.records);

for (const change of changes) {
  console.log(`  ${change.slug}（${change.status}）· ${change.field}.original`);
  console.log(`    - ${preview(change.before)}`);
  console.log(`    + ${preview(change.after)}`);
}

for (const skip of skipped) {
  console.log(`  跳过 ${skip.slug} · ${skip.field}.original：${skip.reason}`);
}

const slugCount = new Set(changes.map((change) => change.slug)).size;

if (changes.length === 0) {
  console.log("无事可做：没有只剩样板的原文字段。");
} else if (!apply) {
  console.log(
    `预览：${slugCount} 条信号、${changes.length} 个字段待修。未写入任何文件。`
  );
} else {
  writeLocalJsonFile(storePath, { ...store, records: next });
  console.log(
    `已写入 ${slugCount} 条信号、${changes.length} 个字段。再跑一次应报告无事可做。`
  );
}
