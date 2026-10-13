// 本页目录: which sections of a long detail page go into its table of
// contents, and which one the reader is in. Pure functions only — the
// component (`src/components/page-toc.tsx`) supplies the geometry.

import type { Locale } from "@/lib/i18n/locale";

export interface PageTocEntry {
  /** The section's element id; the entry links to `#id`. */
  id: string;
  label: string;
}

export interface PageTocCandidate extends PageTocEntry {
  /** Whether the page actually renders this section right now. */
  present: boolean;
}

/**
 * Below this many sections a table of contents repeats what the reader can
 * already see, so none is shown.
 */
export const PAGE_TOC_MIN_ENTRIES = 3;

/**
 * The rendered sections, in page order; an empty list when there are too
 * few of them to be worth a table of contents.
 */
export function selectPageTocEntries(
  candidates: PageTocCandidate[],
  minEntries = PAGE_TOC_MIN_ENTRIES
): PageTocEntry[] {
  const entries = candidates
    .filter((candidate) => candidate.present)
    .map(({ id, label }) => ({ id, label }));

  return entries.length >= minEntries ? entries : [];
}

/** Element ids of the signal page's sections, one place for both sides. */
export const technologyTocIds = {
  evolution: "section-evolution",
  body: "section-body",
  whyItMatters: "section-why-it-matters",
  technicalContext: "section-technical-context",
  audience: "section-audience",
  learningPath: "section-learning-path",
  graph: "section-graph",
  relatedTechnologies: "section-related-technologies",
  similarSignals: "section-similar-signals",
  relatedSkills: "section-related-skills",
  relatedKnowledge: "section-related-knowledge",
  followUpQuestions: "section-follow-up-questions",
  digestAppearances: "section-digest-appearances"
} as const;

/** Table labels of the signal page's sections, by interface language. */
const technologyTocLabels: Record<
  Locale,
  Record<keyof typeof technologyTocIds, string>
> = {
  zh: {
    evolution: "版本脉络",
    body: "信号正文",
    whyItMatters: "为什么重要",
    technicalContext: "技术背景",
    audience: "谁该关注",
    learningPath: "学习路径",
    graph: "关系网络",
    relatedTechnologies: "相关技术",
    similarSignals: "内容相近的信号",
    relatedSkills: "相关技能",
    relatedKnowledge: "相关知识",
    followUpQuestions: "后续问题",
    digestAppearances: "收录于"
  },
  en: {
    evolution: "Release line",
    body: "The signal",
    whyItMatters: "Why it matters",
    technicalContext: "Technical context",
    audience: "Who should care",
    learningPath: "Learning path",
    graph: "Network",
    relatedTechnologies: "Related signals",
    similarSignals: "Similar signals",
    relatedSkills: "Related skills",
    relatedKnowledge: "Related knowledge",
    followUpQuestions: "Follow-up questions",
    digestAppearances: "Featured in"
  }
};

/** The same section's table label wherever the page needs it as a heading. */
export function getTechnologyTocLabel(
  section: keyof typeof technologyTocIds,
  locale: Locale = "zh"
): string {
  return technologyTocLabels[locale][section];
}

export interface TechnologyTocInput {
  locale?: Locale;
  hasEvolution: boolean;
  hasBody: boolean;
  hasWhyItMatters: boolean;
  hasTechnicalContext: boolean;
  hasAudience: boolean;
  learningPathCount: number;
  graphNodeCount: number;
  relatedTechnologyCount: number;
  similarSignalCount: number;
  relatedSkillCount: number;
  relatedKnowledgeCount: number;
  followUpQuestionCount: number;
  /** Published digests that carried the signal; 0 on the workspace preview. */
  digestAppearanceCount: number;
}

/**
 * The signal page's reading sections, each marked present exactly when the
 * page renders it. The three AI widgets are left out on purpose: they are
 * tools a reader triggers, empty until then, not sections to read. So is the
 * 来源参考 block at the foot, which repeats the aside's source panel.
 */
export function getTechnologyTocCandidates(
  input: TechnologyTocInput
): PageTocCandidate[] {
  const ids = technologyTocIds;
  const labels = technologyTocLabels[input.locale ?? "zh"];

  return [
    { id: ids.evolution, label: labels.evolution, present: input.hasEvolution },
    { id: ids.body, label: labels.body, present: input.hasBody },
    {
      id: ids.whyItMatters,
      label: labels.whyItMatters,
      present: input.hasWhyItMatters
    },
    {
      id: ids.technicalContext,
      label: labels.technicalContext,
      present: input.hasTechnicalContext
    },
    { id: ids.audience, label: labels.audience, present: input.hasAudience },
    {
      id: ids.learningPath,
      label: labels.learningPath,
      present: input.learningPathCount > 0
    },
    { id: ids.graph, label: labels.graph, present: input.graphNodeCount > 0 },
    {
      id: ids.relatedTechnologies,
      label: labels.relatedTechnologies,
      present: input.relatedTechnologyCount > 0
    },
    {
      id: ids.similarSignals,
      label: labels.similarSignals,
      present: input.similarSignalCount > 0
    },
    {
      id: ids.relatedSkills,
      label: labels.relatedSkills,
      present: input.relatedSkillCount > 0
    },
    {
      id: ids.relatedKnowledge,
      label: labels.relatedKnowledge,
      present: input.relatedKnowledgeCount > 0
    },
    {
      id: ids.followUpQuestions,
      label: labels.followUpQuestions,
      present: input.followUpQuestionCount > 0
    },
    {
      id: ids.digestAppearances,
      label: labels.digestAppearances,
      present: input.digestAppearanceCount > 0
    }
  ];
}

/**
 * Element ids of the skill and knowledge pages' sections. Where a section is
 * the same kind of thing as one on the signal page, it keeps the signal
 * page's id, so `#section-body` means the body on every detail page.
 */
export const contentDetailTocIds = {
  prerequisites: "section-prerequisites",
  body: technologyTocIds.body,
  graph: technologyTocIds.graph,
  relatedTechnologies: technologyTocIds.relatedTechnologies,
  /** Knowledge pages only: the signals whose body links the concept. */
  bodyMentions: "section-body-mentions",
  /** A skill page lists knowledge here, a knowledge page skills. */
  relatedEntries: {
    skill: technologyTocIds.relatedKnowledge,
    knowledge: technologyTocIds.relatedSkills
  }
} as const;

/** The two content-detail labels that are not a heading of the page. */
const contentDetailTocLabels: Record<
  Locale,
  { prerequisites: string; graph: string }
> = {
  zh: { prerequisites: "先读这些", graph: "关系网络" },
  en: { prerequisites: "Read these first", graph: "Network" }
};

export interface ContentDetailTocInput {
  locale?: Locale;
  kind: "skill" | "knowledge";
  prerequisiteCount: number;
  hasBody: boolean;
  graphNodeCount: number;
  relatedTechnologyCount: number;
  /** Rows of 正文里提到它的信号; a skill page never has the section. */
  bodyMentionCount?: number;
  relatedEntryCount: number;
  /**
   * The h2 of each section whose heading differs by kind, taken from the
   * page's own descriptor so the table and the page cannot drift apart.
   */
  headings: {
    body: string;
    relatedTechnologies: string;
    bodyMentions?: string;
    relatedEntries: string;
  };
}

/**
 * The skill / knowledge page's sections (`ContentDetailPage`), each marked
 * present exactly when the page renders it. The relationship graph is listed
 * as 关系网络, its eyebrow, as on the signal page; the others by their h2.
 */
export function getContentDetailTocCandidates(
  input: ContentDetailTocInput
): PageTocCandidate[] {
  const ids = contentDetailTocIds;
  const labels = contentDetailTocLabels[input.locale ?? "zh"];

  return [
    {
      id: ids.prerequisites,
      label: labels.prerequisites,
      present: input.prerequisiteCount > 0
    },
    { id: ids.body, label: input.headings.body, present: input.hasBody },
    { id: ids.graph, label: labels.graph, present: input.graphNodeCount > 0 },
    {
      id: ids.relatedTechnologies,
      label: input.headings.relatedTechnologies,
      present: input.relatedTechnologyCount > 0
    },
    {
      id: ids.bodyMentions,
      label: input.headings.bodyMentions ?? "",
      present:
        (input.bodyMentionCount ?? 0) > 0 &&
        Boolean(input.headings.bodyMentions)
    },
    {
      id: ids.relatedEntries[input.kind],
      label: input.headings.relatedEntries,
      present: input.relatedEntryCount > 0
    }
  ];
}

/**
 * The digest page's sections (`DailyDigestContent`): element id and h2 text,
 * one place for both the page and its table, so the two cannot drift apart.
 * The skill and knowledge lists keep the signal page's ids, as on the skill
 * and knowledge pages.
 */
export const digestTocSections = {
  summary: { id: "section-summary", label: "今日概览" },
  highPriority: { id: "section-high-priority", label: "今日立即关注" },
  watch: { id: "section-watch", label: "值得跟踪" },
  skills: { id: technologyTocIds.relatedSkills, label: "值得关注的技能" },
  knowledge: { id: technologyTocIds.relatedKnowledge, label: "背景知识" },
  sources: { id: "section-sources", label: "来源参考" }
} as const;

const englishDigestTocLabels: Record<keyof typeof digestTocSections, string> = {
  summary: "Overview",
  highPriority: "Immediate attention",
  watch: "Worth tracking",
  skills: "Skills to watch",
  knowledge: "Background knowledge",
  sources: "Sources"
};

/** The digest sections with their headings in the interface language. */
export function getDigestTocSections(
  locale: Locale = "zh"
): Record<keyof typeof digestTocSections, { id: string; label: string }> {
  if (locale === "zh") {
    return digestTocSections;
  }

  return Object.fromEntries(
    Object.entries(digestTocSections).map(([key, section]) => [
      key,
      {
        id: section.id,
        label: englishDigestTocLabels[key as keyof typeof digestTocSections]
      }
    ])
  ) as Record<keyof typeof digestTocSections, { id: string; label: string }>;
}

export interface DigestTocInput {
  locale?: Locale;
  hasSummary: boolean;
  /**
   * Cards the page shows right now, after the 只看我关注的 filter: a section
   * the filter empties is not rendered at all, so its entry must go too.
   */
  visibleHighPriorityCount: number;
  visibleWatchCount: number;
  skillCount: number;
  knowledgeCount: number;
  sourceCount: number;
}

/**
 * The digest page's sections, each present only when it has something to
 * read. A section with no items still renders a one-line 「暂未选入」 note on
 * the page; the table leaves it out rather than send the reader to it. The
 * 上一期 / 下一期 pager and 订阅简报 block are navigation, not sections.
 */
export function getDigestTocCandidates(
  input: DigestTocInput
): PageTocCandidate[] {
  const sections = getDigestTocSections(input.locale);

  return [
    { ...sections.summary, present: input.hasSummary },
    {
      ...sections.highPriority,
      present: input.visibleHighPriorityCount > 0
    },
    { ...sections.watch, present: input.visibleWatchCount > 0 },
    { ...sections.skills, present: input.skillCount > 0 },
    { ...sections.knowledge, present: input.knowledgeCount > 0 },
    { ...sections.sources, present: input.sourceCount > 0 }
  ];
}

export interface TocSectionGeometry {
  id: string;
  /** Distance of the section's top edge from the viewport top, in px. */
  top: number;
}

export interface ActiveTocOptions {
  /**
   * A section becomes current once its top edge has scrolled up to this
   * line (px from the viewport top). Set just below where an anchor jump
   * lands the section, so the section a reader jumped to is the current one.
   */
  activationLine: number;
  /** The page cannot scroll any further. */
  atBottom: boolean;
  /**
   * The entry the reader last clicked, until they scroll by hand. Near the
   * foot of the page a short section cannot scroll up to the line, and
   * without this the highlight would land on a different entry from the one
   * just clicked.
   */
  pinnedId?: string;
}

/**
 * The section the reader is in: the last one whose top has passed the
 * activation line. `undefined` while the reader is still above the first
 * section (in the hero). At the foot of the page the last section wins,
 * since it may be too short ever to reach the line.
 */
export function pickActiveTocId(
  sections: TocSectionGeometry[],
  { activationLine, atBottom, pinnedId }: ActiveTocOptions
): string | undefined {
  if (sections.length === 0) {
    return undefined;
  }

  if (pinnedId && sections.some((section) => section.id === pinnedId)) {
    return pinnedId;
  }

  if (atBottom) {
    return sections[sections.length - 1].id;
  }

  let active: string | undefined;

  for (const section of sections) {
    if (section.top <= activationLine) {
      active = section.id;
    } else {
      break;
    }
  }

  return active;
}
