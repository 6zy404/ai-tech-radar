// One-off: removes the answers the mock provider wrote into the three public
// AI caches (解读 / 对比 / 学习路径).
//
//   node scripts/run-ts.cjs scripts/purge-mock-ai-cache.ts           # dry run
//   node scripts/run-ts.cjs scripts/purge-mock-ai-cache.ts --apply   # write
//
// In July, before a model was configured, readers' clicks on 生成解读 / 对比 /
// 学习路径 were answered by the mock provider, and the template it wrote was
// cached like a real answer — the live snapshot of 2026-10-14 held 7 mock
// explanations (3 on signals still published) and 1 mock comparison. Since
// 2026-10-14 the generators no longer serve a mock record once a real model
// is configured (`isReusableCachedAiRecord`), so readers already get a fresh
// answer; but a cache entry is only replaced when its exact key is asked for
// again, so the template stays in the file until then. This removes it.
//
// Rule: `planMockAiCachePurge` in src/lib/ai-cache-purge.ts — `mock_llm`
// records go (a record without a generationMode reads as mock, as the guard
// reads it); `llm_assisted` and failed records stay. Only the three cache
// files in the data directory are written, each only when it loses a record,
// and a kept record is written back unchanged. A second run finds nothing.
// The next request for a removed key is answered by the model the server is
// configured with — the mock again, on a server without a key.
import { aiCacheStores, planMockAiCachePurge } from "../src/lib/ai-cache-purge";
import { getAllTechnologies } from "../src/lib/content";
import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "../src/lib/repositories/local-json-store";

const apply = process.argv.slice(3).includes("--apply");

console.log(
  `模式：${apply ? "写入（--apply）" : "只读预演（dry run，加 --apply 才写入）"}`
);

const publishedSlugById = new Map(
  getAllTechnologies().map((technology) => [technology.id, technology.slug])
);

function describeSignals(ids: string[]): string {
  return ids
    .map((id) => publishedSlugById.get(id) ?? `${id || "?"}（未发布）`)
    .join(" × ");
}

const field = (record: Record<string, unknown>, key: string): string =>
  typeof record[key] === "string" && record[key]
    ? (record[key] as string)
    : "-";

let removedTotal = 0;
let keptTotal = 0;
let writtenFiles = 0;

for (const store of aiCacheStores) {
  const storePath = getLocalStoreFilePath(store.fileName);
  const raw = readLocalJsonFile<Record<string, unknown> | null>(
    storePath,
    null
  );

  console.log(`\n${store.label}缓存：${storePath}`);

  if (!raw) {
    console.log("  文件不存在，无事可做。");
    continue;
  }

  const records = Array.isArray(raw[store.listKey])
    ? (raw[store.listKey] as Record<string, unknown>[])
    : [];
  const { kept, removed } = planMockAiCachePurge(records);

  keptTotal += kept.length;
  removedTotal += removed.length;

  for (const record of removed) {
    console.log(`  删除 ${store.keyOf(record) || "（无键）"}`);
    console.log(`    信号：${describeSignals(store.technologyIdsOf(record))}`);
    console.log(
      `    ${field(record, "generationMode")} · ${field(record, "modelName")} · ${field(record, "promptVersion")} · 生成于 ${field(record, "createdAt")}`
    );
  }

  if (removed.length === 0) {
    console.log(`  无事可做：${records.length} 条记录里没有 mock 生成的。`);
    continue;
  }

  console.log(
    `  ${apply ? "已删除" : "待删除"} ${removed.length} 条，保留 ${kept.length} 条。`
  );

  if (apply) {
    writeLocalJsonFile(storePath, {
      ...raw,
      updatedAt: new Date().toISOString(),
      [store.listKey]: kept
    });
    writtenFiles += 1;
  }
}

console.log("");

if (removedTotal === 0) {
  console.log(`无事可做：三个缓存共 ${keptTotal} 条记录，没有 mock 生成的。`);
} else if (!apply) {
  console.log(
    `预览：待删除 ${removedTotal} 条 mock 记录，保留 ${keptTotal} 条。未写入任何文件。`
  );
} else {
  console.log(
    `已写入 ${writtenFiles} 个文件：删除 ${removedTotal} 条 mock 记录，保留 ${keptTotal} 条。再跑一次应报告无事可做。`
  );
}
