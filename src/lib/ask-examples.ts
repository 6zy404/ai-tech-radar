import { getPreferredTechnologyText } from "@/lib/technology-localization";
import type {
  KnowledgeItem,
  SkillItem,
  TechnologyItem,
  TopicTag
} from "@/types/content";

/* 问雷达 example questions, built from what is published right now by fixed
   rules — no model call — so every reader sees the same set at a given
   moment, and each question points at something the site actually has.

   Signal titles are headlines («ADK Kotlin 1.0：智能体逻辑不必再绕回 Python»),
   so a question names a signal by the part before the colon and quotes it;
   a signal whose name is still too long for a one-line chip is skipped. */

export type AskExampleSignal = Pick<
  TechnologyItem,
  | "id"
  | "slug"
  | "publishDate"
  | "title"
  | "sourceLanguage"
  | "tags"
  | "relatedTechnologyIds"
  | "relatedKnowledgeIds"
  | "relatedSkillIds"
>;

export interface AskExampleInput {
  technologies: AskExampleSignal[];
  knowledge: Pick<KnowledgeItem, "id" | "title">[];
  skills: Pick<SkillItem, "id" | "title">[];
  tags: Pick<TopicTag, "id" | "name">[];
}

export const maxAskExamples = 6;
/* How many of the newest signals count as "recent" when picking the concept,
   skill and topic the examples ask about. */
const recentWindow = 12;
const maxNameLength = 20;
const maxPairNameLength = 30;

function length(text: string): number {
  return [...text].length;
}

/* The name a question uses for a signal: the headline's part before its first
   colon, or the whole title when there is none. */
export function getAskSignalName(title: string): string | undefined {
  const whole = title.trim();
  const colon = whole.search(/[：:]/);
  const head = colon > 0 ? whole.slice(0, colon).trim() : "";
  const name = length(head) >= 2 ? head : whole;

  return length(name) >= 2 && length(name) <= maxNameLength ? name : undefined;
}

/* The id referenced most often across the recent signals; a tie goes to the
   one a newer signal referenced first. */
function mostReferenced(
  recent: AskExampleSignal[],
  pick: (signal: AskExampleSignal) => string[] | undefined,
  known: Set<string>
): string | undefined {
  const counts = new Map<string, number>();

  for (const signal of recent) {
    for (const id of pick(signal) ?? []) {
      if (known.has(id)) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
  }

  let best: string | undefined;

  for (const [id, count] of counts) {
    if (best === undefined || count > (counts.get(best) ?? 0)) {
      best = id;
    }
  }

  return best;
}

export function buildAskExamples(input: AskExampleInput): string[] {
  const signals = [...input.technologies].sort(
    (left, right) =>
      right.publishDate.localeCompare(left.publishDate) ||
      left.slug.localeCompare(right.slug)
  );
  const names = new Map<string, string>();

  for (const signal of signals) {
    const name = getAskSignalName(
      getPreferredTechnologyText(signal.title, signal.sourceLanguage)
    );

    if (name) {
      names.set(signal.id, name);
    }
  }

  const recent = signals.slice(0, recentWindow);
  const named = signals.filter((signal) => names.has(signal.id));
  const [first, second] = named;

  const aboutSignal = (signal: AskExampleSignal | undefined) =>
    signal
      ? `「${names.get(signal.id)}」讲了什么，为什么值得关注？`
      : undefined;

  // A comparison needs two published signals the editors linked to each
  // other. Prefer one not already asked about, so the set covers more ground.
  let comparison: string | undefined;
  const asked = new Set([first?.id, second?.id]);
  const byPreference = [
    ...named.filter((signal) => !asked.has(signal.id)),
    ...named.filter((signal) => asked.has(signal.id))
  ];

  for (const signal of byPreference) {
    const name = names.get(signal.id) ?? "";
    const partner = (signal.relatedTechnologyIds ?? [])
      .map((id) => names.get(id))
      .find(
        (other) =>
          other !== undefined &&
          other !== name &&
          length(name) + length(other) <= maxPairNameLength
      );

    if (partner) {
      comparison = `「${name}」和「${partner}」有什么区别？`;
      break;
    }
  }

  const knowledgeTitles = new Map(
    input.knowledge.map((item) => [item.id, item.title])
  );
  const skillTitles = new Map(
    input.skills.map((item) => [item.id, item.title])
  );
  const tagNames = new Map(input.tags.map((tag) => [tag.id, tag.name]));

  const knowledgeId = mostReferenced(
    recent,
    (signal) => signal.relatedKnowledgeIds,
    new Set(knowledgeTitles.keys())
  );
  const skillId = mostReferenced(
    recent,
    (signal) => signal.relatedSkillIds,
    new Set(skillTitles.keys())
  );
  const tagId = mostReferenced(
    recent,
    (signal) => signal.tags,
    new Set(tagNames.keys())
  );

  const questions = [
    aboutSignal(first),
    comparison,
    knowledgeId
      ? `「${knowledgeTitles.get(knowledgeId)}」是什么？最近哪些信号和它有关？`
      : undefined,
    tagId
      ? `最近「${tagNames.get(tagId)}」方向有哪些值得关注的信号？`
      : undefined,
    skillId
      ? `想掌握「${skillTitles.get(skillId)}」，应该先读哪些内容？`
      : undefined,
    aboutSignal(second)
  ];

  return [
    ...new Set(
      questions.filter((question): question is string => Boolean(question))
    )
  ].slice(0, maxAskExamples);
}
