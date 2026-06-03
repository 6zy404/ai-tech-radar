import { getDigestTechnologySections } from "@/lib/digest-workflow";
import { getAllKnowledge, getAllSkills, getAllTags } from "@/lib/content";
import type {
  DailyDigest,
  KnowledgeItem,
  SkillItem,
  TechnologyItem,
  TopicTag
} from "@/types/content";

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
