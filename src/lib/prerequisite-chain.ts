import { getAllKnowledge, getAllSkills } from "@/lib/content";
import { getAllLinkRelations } from "@/lib/link-relation-workflow";
import type { KnowledgeItem, LinkRelation, SkillItem } from "@/types/content";

export type PrerequisiteKind = "skill" | "knowledge";

export interface PrerequisiteStep {
  id: string;
  kind: PrerequisiteKind;
  /** 1 = the current item requires it directly. */
  depth: number;
  /** The item on the chain that requires this one. */
  requiredById: string;
  /** The `requires` edge's note: why `requiredById` needs this first. */
  note?: string;
}

/** How far back the chain is followed. */
export const PREREQUISITE_MAX_DEPTH = 3;

// Direction: `requires` is the one relation type whose meaning depends on
// which side is which, and it is read as "`from` requires `to`" — reading
// `from` needs `to` first. That is how every seed entry in
// `src/data/relations.ts` is written, and how the workspace editors store an
// override: `from` is the entity being edited (`planLinkRelationSync`). The
// rest of the project reads relations as unordered pairs (`findRelationBetween`)
// because there the type is symmetric; here it is not, so the stored order is
// the only thing that says which page to read first.
//
// Pure core, so ordering, cycles and the depth limit are testable without the
// filesystem-backed content getters. `nodes` is the set of items allowed on
// the chain (published skills and knowledge); an edge pointing anywhere else
// is dropped.
export function buildPrerequisiteChain(
  startId: string,
  nodes: Map<string, PrerequisiteKind>,
  relations: LinkRelation[],
  maxDepth: number = PREREQUISITE_MAX_DEPTH
): PrerequisiteStep[] {
  if (!nodes.has(startId)) {
    return [];
  }

  const requires = new Map<string, { toId: string; note?: string }[]>();

  for (const relation of relations) {
    if (
      relation.relationType !== "requires" ||
      relation.fromId === relation.toId ||
      nodes.get(relation.fromId) !== relation.fromType ||
      nodes.get(relation.toId) !== relation.toType
    ) {
      continue;
    }

    const list = requires.get(relation.fromId) ?? [];
    list.push({ toId: relation.toId, note: relation.note });
    requires.set(relation.fromId, list);
  }

  // Each prerequisite is placed at its *longest* distance from the start, so
  // anything it requires in turn sits further back and is listed before it.
  // The walk never revisits a node already on the current path, which is what
  // stops a cycle; the depth limit bounds the rest.
  const steps = new Map<string, PrerequisiteStep>();
  const discovery: string[] = [];
  const onPath = new Set<string>([startId]);

  const walk = (fromId: string, depth: number) => {
    if (depth > maxDepth) {
      return;
    }

    for (const edge of requires.get(fromId) ?? []) {
      if (onPath.has(edge.toId)) {
        continue;
      }

      const existing = steps.get(edge.toId);

      if (!existing) {
        discovery.push(edge.toId);
      }

      if (!existing || existing.depth < depth) {
        steps.set(edge.toId, {
          id: edge.toId,
          kind: nodes.get(edge.toId) as PrerequisiteKind,
          depth,
          requiredById: fromId,
          ...(edge.note ? { note: edge.note } : {})
        });
      }

      onPath.add(edge.toId);
      walk(edge.toId, depth + 1);
      onPath.delete(edge.toId);
    }
  };

  walk(startId, 1);

  // Read-first order: deepest first; equal depths keep discovery order, which
  // follows the stored relation order and so stays stable between renders.
  return discovery
    .map((id) => steps.get(id) as PrerequisiteStep)
    .sort(
      (a, b) =>
        b.depth - a.depth || discovery.indexOf(a.id) - discovery.indexOf(b.id)
    );
}

export type PrerequisiteEntry = PrerequisiteStep &
  (
    | { kind: "skill"; item: SkillItem }
    | { kind: "knowledge"; item: KnowledgeItem }
  ) & { requiredByTitle: string };

/**
 * The read-first chain for one published skill or knowledge item, over the
 * merged public pools. Only pairs that are actually linked (either side lists
 * the other in its related ids — the same rule `getContentGraph` uses) count,
 * so a relation override left behind after an editor unlinked a pair cannot
 * put an item on the chain that the page shows nowhere else.
 */
export function getPrerequisiteChain(
  itemId: string,
  maxDepth: number = PREREQUISITE_MAX_DEPTH
): PrerequisiteEntry[] {
  const skills = getAllSkills();
  const knowledge = getAllKnowledge();
  const skillById = new Map(skills.map((item) => [item.id, item]));
  const knowledgeById = new Map(knowledge.map((item) => [item.id, item]));
  const nodes = new Map<string, PrerequisiteKind>([
    ...skills.map((item) => [item.id, "skill"] as const),
    ...knowledge.map((item) => [item.id, "knowledge"] as const)
  ]);

  const linkedPairs = new Set<string>();
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  for (const skill of skills) {
    for (const id of skill.relatedKnowledgeIds) {
      linkedPairs.add(pairKey(skill.id, id));
    }
  }

  for (const item of knowledge) {
    for (const id of item.relatedSkillIds) {
      linkedPairs.add(pairKey(item.id, id));
    }
  }

  const relations = getAllLinkRelations().filter((relation) =>
    linkedPairs.has(pairKey(relation.fromId, relation.toId))
  );

  const titleOf = (id: string) =>
    skillById.get(id)?.title ?? knowledgeById.get(id)?.title ?? "";

  return buildPrerequisiteChain(itemId, nodes, relations, maxDepth).map(
    (step) => {
      const requiredByTitle = titleOf(step.requiredById);

      return step.kind === "skill"
        ? {
            ...step,
            kind: "skill",
            item: skillById.get(step.id) as SkillItem,
            requiredByTitle
          }
        : {
            ...step,
            kind: "knowledge",
            item: knowledgeById.get(step.id) as KnowledgeItem,
            requiredByTitle
          };
    }
  );
}
