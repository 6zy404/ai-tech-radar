// One-off: removes GitHub Blog's WordPress footer from published signals.
//
//   node scripts/run-ts.cjs scripts/fix-github-blog-footer.ts           # dry run
//   node scripts/run-ts.cjs scripts/fix-github-blog-footer.ts --apply   # write
//
// Every GitHub Blog feed summary ends in "The post {title} appeared first on
// The GitHub Blog." The importer strips it since 2026-09-30 (`cleanFeedText`
// in src/lib/text-sanitize.ts), but signals converted earlier kept it in their
// `original` and `en` summary, which the 原文 reading mode shows. Measured
// 2026-09-30 on a worktree copy: 1 published signal (seclab-fuzzing-taskflow),
// 2 fields.
//
// Published records only; `summary` and `content`, `original` and `en` only;
// a field is changed only when the footer is its last sentence, and a field
// that would be left empty is skipped. A second run finds nothing. Only
// `technology-workspace.json` (or LOCAL_DATA_DIR's copy) is written. Rules:
// src/lib/github-blog-footer-repair.ts.
import { planGitHubBlogFooterRepair } from "../src/lib/github-blog-footer-repair";
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

function tail(value: string): string {
  const flat = value.replace(/\s+/g, " ");

  return flat.length <= 110 ? flat : `...${flat.slice(-107)}`;
}

const { next, changes, skipped } = planGitHubBlogFooterRepair(store.records);

for (const change of changes) {
  console.log(`  ${change.slug} · ${change.field}`);
  console.log(`    - ${tail(change.before)}`);
  console.log(`    + ${tail(change.after)}`);
}

for (const skip of skipped) {
  console.log(`  跳过 ${skip.slug} · ${skip.field}：${skip.reason}`);
}

const slugCount = new Set(changes.map((change) => change.slug)).size;

if (changes.length === 0) {
  console.log("无事可做：已发布信号里没有结尾带 GitHub Blog 样板的字段。");
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
