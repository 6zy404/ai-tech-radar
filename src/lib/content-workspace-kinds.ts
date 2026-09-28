import type {
  ContentWorkspaceFormKind,
  ContentWorkspaceRelatedGroup
} from "@/components/content-workspace-form";
import { getAllKnowledge, getAllSkills } from "@/lib/content";
import {
  difficultyLabels,
  difficultyLevels,
  heatLabels,
  heatLevels,
  knowledgeCategories,
  knowledgeCategoryLabels,
  learningCosts,
  learningCostValues,
  skillTypeLabels,
  skillTypes
} from "@/lib/content-labels";
import type { ContentWorkspaceEntryOf } from "@/lib/content-workspace-workflow";
import {
  getKnowledgePublishReadiness,
  getKnowledgeWorkspaceEntries,
  getKnowledgeWorkspaceEntryById
} from "@/lib/knowledge-workflow";
import type { PublishReadinessResult } from "@/lib/publish-readiness";
import {
  getSkillPublishReadiness,
  getSkillWorkspaceEntries,
  getSkillWorkspaceEntryById
} from "@/lib/skill-workflow";
import type { KnowledgeItem, SkillItem } from "@/types/content";

type ContentWorkspaceEntry = ContentWorkspaceEntryOf<SkillItem | KnowledgeItem>;

/**
 * Everything the skill and knowledge workspace pages need to know about
 * their kind: copy, paths, attributes, the workflow reads, and the related
 * pool besides technologies. `form` is the serializable part handed to the
 * client form.
 */
export interface ContentWorkspaceKindView {
  form: ContentWorkspaceFormKind;
  /** The list page's one-line description. */
  listDescription: string;
  /** The list rows' meta labels, one per attribute (same order). */
  metaLabels: string[];
  getEntries: () => ContentWorkspaceEntry[];
  getEntryById: (id: string) => ContentWorkspaceEntry | undefined;
  getPublishReadiness: (id: string) => PublishReadinessResult;
  /** The second related pool: its field, legend, kind and options. */
  getRelatedGroup: () => ContentWorkspaceRelatedGroup;
}

function options(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] }));
}

export const skillWorkspaceKind: ContentWorkspaceKindView = {
  form: {
    entityType: "skill",
    noun: "技能",
    entryNoun: "技能",
    apiBasePath: "/api/workspace/skills",
    workspacePath: "/workspace/skills",
    publicPath: "/skills",
    attributes: [
      {
        key: "skillType",
        label: "技能类型",
        fallback: "engineering",
        options: options(skillTypes, skillTypeLabels)
      },
      {
        key: "heatLevel",
        label: "热度",
        fallback: "active",
        options: options(heatLevels, heatLabels)
      },
      {
        key: "learningCost",
        label: "学习成本",
        fallback: "medium",
        options: options(learningCosts, learningCostValues)
      }
    ]
  },
  listDescription:
    "面向读者的实践技能条目。种子条目与工作台条目在这里统一管理，草稿不会出现在公开页面。",
  metaLabels: ["类型", "热度", "学习成本"],
  getEntries: getSkillWorkspaceEntries,
  getEntryById: getSkillWorkspaceEntryById,
  getPublishReadiness: getSkillPublishReadiness,
  getRelatedGroup: () => ({
    name: "relatedKnowledgeIds",
    legend: "相关知识",
    targetType: "knowledge",
    options: getAllKnowledge().map((knowledge) => ({
      id: knowledge.id,
      title: knowledge.title
    }))
  })
};

export const knowledgeWorkspaceKind: ContentWorkspaceKindView = {
  form: {
    entityType: "knowledge",
    noun: "知识",
    entryNoun: "知识条目",
    apiBasePath: "/api/workspace/knowledge",
    workspacePath: "/workspace/knowledge",
    publicPath: "/knowledge",
    attributes: [
      {
        key: "category",
        label: "分类",
        fallback: "machine-learning",
        options: options(knowledgeCategories, knowledgeCategoryLabels)
      },
      {
        key: "difficulty",
        label: "难度",
        fallback: "foundation",
        options: options(difficultyLevels, difficultyLabels)
      }
    ]
  },
  listDescription:
    "解释技术信号的经典概念条目。种子条目与工作台条目在这里统一管理，草稿不会出现在公开页面。",
  metaLabels: ["分类", "难度"],
  getEntries: getKnowledgeWorkspaceEntries,
  getEntryById: getKnowledgeWorkspaceEntryById,
  getPublishReadiness: getKnowledgePublishReadiness,
  getRelatedGroup: () => ({
    name: "relatedSkillIds",
    legend: "相关技能",
    targetType: "skill",
    options: getAllSkills().map((skill) => ({
      id: skill.id,
      title: skill.title
    }))
  })
};
