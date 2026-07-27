import { getAllTechnologies } from "@/lib/content";
import { getAllLinkRelations } from "@/lib/link-relation-workflow";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";
import type { LinkRelation, TechnologyItem } from "@/types/content";

export interface TechnologyEvolutionStep {
  id: string;
  slug: string;
  title: string;
  publishDate: string;
  isCurrent: boolean;
  note?: string;
}

export interface TechnologyEvolutionChain {
  steps: TechnologyEvolutionStep[];
  currentIndex: number;
  laterCount: number;
}

// Pure core, so the ordering and grouping rules are testable without the
// filesystem-backed content getters.
export function buildTechnologyEvolutionChain(
  technologyId: string,
  technologies: TechnologyItem[],
  relations: LinkRelation[]
): TechnologyEvolutionChain | undefined {
  const byId = new Map(technologies.map((item) => [item.id, item]));

  if (!byId.has(technologyId)) {
    return undefined;
  }

  // "supersedes" is stored as an unordered pair like every other relation in
  // this project, so the chain is built as an undirected component and ordered
  // by publish date rather than by the recorded from/to direction.
  const neighbors = new Map<string, Set<string>>();
  const notes = new Map<string, string>();

  for (const relation of relations) {
    if (
      relation.relationType !== "supersedes" ||
      relation.fromType !== "technology" ||
      relation.toType !== "technology"
    ) {
      continue;
    }

    if (!byId.has(relation.fromId) || !byId.has(relation.toId)) {
      continue;
    }

    if (relation.fromId === relation.toId) {
      continue;
    }

    const from = neighbors.get(relation.fromId) ?? new Set<string>();
    from.add(relation.toId);
    neighbors.set(relation.fromId, from);

    const to = neighbors.get(relation.toId) ?? new Set<string>();
    to.add(relation.fromId);
    neighbors.set(relation.toId, to);

    if (relation.note) {
      // The note describes the succession itself; attach it to the newer of
      // the two so it reads as "what this release carried forward".
      const fromItem = byId.get(relation.fromId) as TechnologyItem;
      const toItem = byId.get(relation.toId) as TechnologyItem;
      const newerId =
        fromItem.publishDate >= toItem.publishDate
          ? relation.fromId
          : relation.toId;

      notes.set(newerId, relation.note);
    }
  }

  if (!neighbors.has(technologyId)) {
    return undefined;
  }

  const visited = new Set<string>([technologyId]);
  const queue = [technologyId];

  while (queue.length > 0) {
    const nextId = queue.shift() as string;

    for (const neighborId of neighbors.get(nextId) ?? []) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  if (visited.size < 2) {
    return undefined;
  }

  const steps = [...visited]
    .map((id) => byId.get(id) as TechnologyItem)
    .sort((a, b) => {
      if (a.publishDate !== b.publishDate) {
        return a.publishDate < b.publishDate ? -1 : 1;
      }

      return a.slug.localeCompare(b.slug);
    })
    .map((item) => ({
      id: item.id,
      slug: item.slug,
      title: getPreferredTechnologyTitle(item),
      publishDate: item.publishDate,
      isCurrent: item.id === technologyId,
      note: notes.get(item.id)
    }));

  const currentIndex = steps.findIndex((step) => step.isCurrent);

  return {
    steps,
    currentIndex,
    laterCount: steps.length - 1 - currentIndex
  };
}

export function getTechnologyEvolutionChain(
  technologyId: string
): TechnologyEvolutionChain | undefined {
  return buildTechnologyEvolutionChain(
    technologyId,
    getAllTechnologies(),
    getAllLinkRelations()
  );
}
