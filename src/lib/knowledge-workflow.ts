import { knowledgeItems } from "@/data/knowledge";
import {
  createContentWorkspaceWorkflow,
  type ContentWorkspaceEntryOf,
  type ContentWorkspaceStoreOf,
  type ContentWorkspaceUpdateOf
} from "@/lib/content-workspace-workflow";
import { difficultyLevels, knowledgeCategories } from "@/lib/content-labels";
import type { KnowledgeItem } from "@/types/content";

export type KnowledgeWorkspaceStore = ContentWorkspaceStoreOf<KnowledgeItem>;
export type KnowledgeWorkspaceEntry = ContentWorkspaceEntryOf<KnowledgeItem>;
export type KnowledgeWorkspaceUpdate = ContentWorkspaceUpdateOf<KnowledgeItem>;

const workflow = createContentWorkspaceWorkflow<KnowledgeItem>({
  entityType: "knowledge",
  errorLabel: "Knowledge",
  storeFileName: "knowledge-workspace.json",
  seeds: knowledgeItems,
  attributes: [
    {
      key: "category",
      values: knowledgeCategories,
      fallback: "machine-learning"
    },
    { key: "difficulty", values: difficultyLevels, fallback: "foundation" }
  ],
  relatedIdsKey: "relatedSkillIds",
  duplicateSlugLabel: "知识条目",
  missingRelatedLabel: "技能"
});

export const readKnowledgeWorkspaceStore = workflow.readStore;
export const buildKnowledgeWorkspaceEntries = workflow.buildEntries;
export const getKnowledgeWorkspaceEntries = workflow.getEntries;
export const getKnowledgeWorkspaceEntryById = workflow.getEntryById;
export const evaluateKnowledgePublishReadiness =
  workflow.evaluatePublishReadiness;
export const getKnowledgePublishReadiness = workflow.getPublishReadiness;
export const createKnowledgeWorkspaceRecord = workflow.createRecord;
export const updateKnowledgeWorkspaceRecord = workflow.updateRecord;
export const updateKnowledgeWorkspaceStatus = workflow.updateStatus;
export const applyKnowledgeWorkspaceOverlay = workflow.applyOverlay;
export const getMergedPublicKnowledge = workflow.getMergedPublic;
