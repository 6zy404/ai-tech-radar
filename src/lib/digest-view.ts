import { getDigestTechnologySections } from "@/lib/digest-workflow";
import { getAllKnowledge, getAllSkills, getAllTags } from "@/lib/content";
import {
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
