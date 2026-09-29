// One-off: reverses two 必备 (requires) overrides that were stored backwards.
//
//   node scripts/run-ts.cjs scripts/fix-requires-direction.ts           # dry run
//   node scripts/run-ts.cjs scripts/fix-requires-direction.ts --apply   # write
//
// `requires` is the one relation type read with its direction: `from` needs
// `to` first (src/lib/prerequisite-chain.ts). Until 2026-09-29 every editor
// save wrote the edited entity as `from`, so both of these pairs — saved from
// the knowledge item 完成判定与验收信号 — say the knowledge needs the skill
// first, while their notes say the opposite. Measured 2026-09-29: 2 of the 19
// skill/knowledge `requires` edges.
//
// Only `config/link-relation-workspace.json` (or LOCAL_DATA_DIR's copy) is
// touched, and only these two ids, and only when they still hold the exact
// reversed value below — a second run, or a pair an editor has changed
// since, is reported and left alone. Ids, notes and every other relation are
// unchanged.
import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "../src/lib/repositories/local-json-store";
import type { LinkRelation } from "../src/types/content";

interface Fix {
  id: string;
  label: string;
  reversedFrom: string;
  reversedTo: string;
}

const COMPLETION_KNOWLEDGE = "knowledge-ws-e251051e"; // 完成判定与验收信号

const fixes: Fix[] = [
  {
    id: "rel-ws-254bb11a",
    label: "智能体可观测性与评测运维 需要先读 完成判定与验收信号",
    reversedFrom: COMPLETION_KNOWLEDGE,
    reversedTo: "skill-ws-f741f122"
  },
  {
    id: "rel-ws-7f2d6840",
    label: "智能体工作流设计 需要先读 完成判定与验收信号",
    reversedFrom: COMPLETION_KNOWLEDGE,
    reversedTo: "skill-agent-design"
  }
];

const apply = process.argv.slice(3).includes("--apply");
const storePath = getLocalStoreFilePath("link-relation-workspace.json");
const store = readLocalJsonFile<{
  updatedAt?: string;
  relations?: LinkRelation[];
}>(storePath, {});
const relations = store.relations ?? [];

function describe(relation: LinkRelation): string {
  return `${relation.fromType}:${relation.fromId} → ${relation.toType}:${relation.toId} (${relation.relationType})`;
}

let pending = 0;

for (const fix of fixes) {
  const index = relations.findIndex((relation) => relation.id === fix.id);
  const relation = relations[index];

  console.log(`${fix.id} · ${fix.label}`);

  if (!relation) {
    console.log("  不在覆盖层里，跳过。");
    continue;
  }

  if (
    relation.relationType === "requires" &&
    relation.fromId === fix.reversedTo &&
    relation.toId === fix.reversedFrom
  ) {
    console.log(`  已是正确方向：${describe(relation)}`);
    continue;
  }

  if (
    relation.relationType !== "requires" ||
    relation.fromId !== fix.reversedFrom ||
    relation.toId !== fix.reversedTo
  ) {
    console.log(`  与预期不符，未改动：${describe(relation)}`);
    continue;
  }

  const next: LinkRelation = {
    ...relation,
    fromId: relation.toId,
    fromType: relation.toType,
    toId: relation.fromId,
    toType: relation.fromType
  };

  console.log(`  - ${describe(relation)}`);
  console.log(`  + ${describe(next)}`);
  relations[index] = next;
  pending += 1;
}

if (pending === 0) {
  console.log("没有需要修正的边。");
} else if (!apply) {
  console.log(`预览：${pending} 条待修正。加 --apply 写入 ${storePath}`);
} else {
  writeLocalJsonFile(storePath, {
    ...store,
    updatedAt: new Date().toISOString(),
    relations
  });
  console.log(`已写入 ${pending} 条：${storePath}`);
}
