import {
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies
} from "@/lib/content";
import { radarQuadrants, radarRings } from "@/lib/radar-labels";
import { getMergedPublicRadarEntries } from "@/lib/radar-workflow";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";
import type { KnowledgeItem, SkillItem, TechnologyItem } from "@/types/content";
import type {
  RadarChangeKind,
  RadarEntry,
  RadarPublicEntry,
  RadarRing
} from "@/types/radar";

// The public side of the radar: the one mapping from a merged RadarEntry to
// what /radar renders. It picks fields by name, resolves ids only against
// published signals, skills and knowledge, and drops anything else, so no
// workspace status, timestamp or unpublished reference can reach the page.

/** A change this many days before the newest one still counts as 本期. */
export const radarEditionWindowDays = 30;

export interface RadarEdition {
  /** The day the radar first went up: the earliest entry date. */
  firstDate: string;
  /** The newest history line across every entry. */
  latestDate: string;
  /** No change since the first edition — nothing can be new or moved yet. */
  isFirstEdition: boolean;
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000
  );
}

export function getRadarEdition(entries: RadarEntry[]): RadarEdition {
  const firstDates = entries
    .map((entry) => entry.history[0]?.date)
    .filter((date): date is string => Boolean(date))
    .sort();
  const allDates = entries
    .flatMap((entry) => entry.history.map((line) => line.date))
    .sort();
  const firstDate = firstDates[0] ?? "";
  const latestDate = allDates[allDates.length - 1] ?? "";

  // A ring change on the first day still makes it a second edition.
  const isFirstEdition = entries.every(
    (entry) =>
      entry.history.every((line) => line.fromRing === undefined) &&
      (entry.history[0]?.date ?? firstDate) === firstDate
  );

  return { firstDate, latestDate, isFirstEdition };
}

/**
 * 本期 is the {@link radarEditionWindowDays} days ending on the newest
 * change anywhere on the radar — so the page does not change on its own as
 * days pass, only when an editor changes something.
 *
 * - 新进: the entry's first line is inside the window and later than the
 *   first edition (the first edition is the baseline, so nothing on it is
 *   "new").
 * - 移动: its ring at the start of the window differs from its ring now —
 *   a move and a move back is no move.
 */
export function deriveRadarChange(
  entry: RadarEntry,
  edition: RadarEdition
): { change: RadarChangeKind; movedFrom?: RadarRing } {
  const inWindow = (date: string) =>
    daysBetween(date, edition.latestDate) < radarEditionWindowDays;
  const first = entry.history[0];

  if (first && inWindow(first.date) && first.date > edition.firstDate) {
    return { change: "new" };
  }

  const firstMove = entry.history.find(
    (line) => line.fromRing !== undefined && inWindow(line.date)
  );

  if (firstMove?.fromRing && firstMove.fromRing !== entry.ring) {
    return { change: "moved", movedFrom: firstMove.fromRing };
  }

  return { change: "unchanged" };
}

const nameCollator = new Intl.Collator("zh-Hans-CN");

/** List order, which is also the numbering: quadrant, ring, then name. */
export function compareRadarEntries(left: RadarEntry, right: RadarEntry) {
  return (
    radarQuadrants.indexOf(left.quadrant) -
      radarQuadrants.indexOf(right.quadrant) ||
    radarRings.indexOf(left.ring) - radarRings.indexOf(right.ring) ||
    nameCollator.compare(left.name, right.name) ||
    left.slug.localeCompare(right.slug)
  );
}

export interface RadarPublicPools {
  technologies: TechnologyItem[];
  knowledge: KnowledgeItem[];
  skills: SkillItem[];
}

/**
 * Pure. `pools` must hold published content only — the content getters
 * already filter drafts — and an id that is not in them is dropped.
 */
export function toPublicRadarEntries(
  entries: RadarEntry[],
  pools: RadarPublicPools
): RadarPublicEntry[] {
  const technologies = new Map(
    pools.technologies
      .filter((item) => item.status === "published")
      .map((item) => [item.id, item])
  );
  const knowledge = new Map(pools.knowledge.map((item) => [item.id, item]));
  const skills = new Map(pools.skills.map((item) => [item.id, item]));
  const edition = getRadarEdition(entries);

  return [...entries].sort(compareRadarEntries).map((entry, index) => {
    const { change, movedFrom } = deriveRadarChange(entry, edition);

    return {
      number: index + 1,
      name: entry.name,
      slug: entry.slug,
      quadrant: entry.quadrant,
      ring: entry.ring,
      ringReason: entry.ringReason,
      change,
      ...(movedFrom ? { movedFrom } : {}),
      evidence: entry.evidenceTechnologyIds.flatMap((id) => {
        const item = technologies.get(id);

        return item
          ? [
              {
                slug: item.slug,
                title: getPreferredTechnologyTitle(item),
                publishDate: item.publishDate
              }
            ]
          : [];
      }),
      knowledge: entry.relatedKnowledgeIds.flatMap((id) => {
        const item = knowledge.get(id);

        return item ? [{ slug: item.slug, title: item.title }] : [];
      }),
      skills: entry.relatedSkillIds.flatMap((id) => {
        const item = skills.get(id);

        return item ? [{ slug: item.slug, title: item.title }] : [];
      }),
      history: entry.history.map((line) => ({
        date: line.date,
        ...(line.fromRing ? { fromRing: line.fromRing } : {}),
        toRing: line.toRing,
        reason: line.reason
      }))
    };
  });
}

export interface PublicRadar {
  entries: RadarPublicEntry[];
  edition: RadarEdition;
}

/**
 * Everything /radar shows. An entry whose evidence resolves to no
 * published signal is left off: the radar never states a placement it
 * cannot point to.
 */
export function getPublicRadar(): PublicRadar {
  const merged = getMergedPublicRadarEntries();
  const entries = toPublicRadarEntries(merged, {
    technologies: getAllTechnologies(),
    knowledge: getAllKnowledge(),
    skills: getAllSkills()
  }).filter((entry) => entry.evidence.length > 0);
  // Renumber after the filter so the numbers on the picture run 1…n.
  const numbered = entries.map((entry, index) => ({
    ...entry,
    number: index + 1
  }));

  return { entries: numbered, edition: getRadarEdition(merged) };
}
