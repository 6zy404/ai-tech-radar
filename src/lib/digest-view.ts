import {
  getDailyDigests,
  getDigestTechnologySections
} from "@/lib/digest-workflow";
import { findIssueNeighbors } from "@/lib/issue-neighbors";
import type { DigestShareCardInput } from "@/lib/share-card";
import { getAllKnowledge, getAllSkills, getAllTags } from "@/lib/content";
import { contentBodyToPlainText } from "@/lib/content-body";
import {
  containsInternalPublicCopy,
  getPublicDigestSummary,
  getPublicDigestTitle
} from "@/lib/public-copy";
import type {
  DailyDigest,
  KnowledgeItem,
  SkillItem,
  TechnologyItem,
  TopicTag
} from "@/types/content";

// Public-safe digest view for rendering. This is the only digest shape that
// may cross into the component tree (and therefore the RSC payload) —
// internal-only fields such as editorialNotes and the manual adjustment id
// lists must never leave the workflow layer. See docs/security-boundary.md.
export interface PublicDigestView {
  date: string;
  title: string;
  summary: string;
  sourceNames: string[];
}

export function toPublicDigestView(digest: DailyDigest): PublicDigestView {
  return {
    date: digest.date,
    title: getPublicDigestTitle(digest),
    summary: getPublicDigestSummary(digest),
    sourceNames: digest.sourceNames
  };
}

// What the digest share card shows: the public title, the editorial summary
// (the page's 今日概览, under the same internal-copy guard as every other
// public digest string), the issue date, and the two section counts from the
// hero's meta row — counted the same way the page counts them, so the card
// cannot disagree with the page it links to.
export function toDigestShareCardInput(
  digest: DailyDigest
): DigestShareCardInput {
  const { highPriorityTechnologies, watchTechnologies } =
    getDigestTechnologySections(digest);
  const editorialSummary = digest.editorialSummary?.trim();

  return {
    date: digest.date,
    title: getPublicDigestTitle(digest),
    lede:
      editorialSummary && !containsInternalPublicCopy(editorialSummary)
        ? contentBodyToPlainText(editorialSummary)
        : undefined,
    highPriorityCount: highPriorityTechnologies.length,
    watchCount: watchTechnologies.length
  };
}

export interface DailyDigestRenderData {
  highPriorityTechnologies: TechnologyItem[];
  watchTechnologies: TechnologyItem[];
  skills: SkillItem[];
  knowledge: KnowledgeItem[];
  tags: TopicTag[];
}

export function getDailyDigestRenderData(
  digest: DailyDigest
): DailyDigestRenderData {
  const { highPriorityTechnologies, watchTechnologies } =
    getDigestTechnologySections(digest);
  const skillById = new Map(getAllSkills().map((skill) => [skill.id, skill]));
  const knowledgeById = new Map(
    getAllKnowledge().map((knowledge) => [knowledge.id, knowledge])
  );

  return {
    highPriorityTechnologies,
    watchTechnologies,
    skills: digest.skillIds
      .map((skillId) => skillById.get(skillId))
      .filter((skill): skill is SkillItem => Boolean(skill)),
    knowledge: digest.knowledgeIds
      .map((knowledgeId) => knowledgeById.get(knowledgeId))
      .filter((item): item is KnowledgeItem => Boolean(item)),
    tags: getAllTags()
  };
}

export interface PublicDigestNeighbors {
  previousDate?: string;
  nextDate?: string;
}

// The published digests either side of `date`, for the 上一期 / 下一期 pager.
// Only dates cross into the page: drafts and archived digests never count as
// a neighbour, so the pager cannot link to a page that would 404.
export function getPublishedDigestNeighbors(
  date: string
): PublicDigestNeighbors {
  const { previous, next } = findIssueNeighbors(
    getDailyDigests()
      .filter((digest) => digest.status === "published")
      .map((digest) => digest.date),
    date
  );

  return { previousDate: previous, nextDate: next };
}
