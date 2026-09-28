import { skillItems } from "@/data/skills";
import {
  createContentWorkspaceWorkflow,
  type ContentWorkspaceEntryOf,
  type ContentWorkspaceStoreOf,
  type ContentWorkspaceUpdateOf
} from "@/lib/content-workspace-workflow";
import { heatLevels, learningCosts, skillTypes } from "@/lib/content-labels";
import type { SkillItem } from "@/types/content";

export type SkillWorkspaceStore = ContentWorkspaceStoreOf<SkillItem>;
export type SkillWorkspaceEntry = ContentWorkspaceEntryOf<SkillItem>;
export type SkillWorkspaceUpdate = ContentWorkspaceUpdateOf<SkillItem>;

const workflow = createContentWorkspaceWorkflow<SkillItem>({
  entityType: "skill",
  errorLabel: "Skill",
  storeFileName: "skill-workspace.json",
  seeds: skillItems,
  attributes: [
    { key: "skillType", values: skillTypes, fallback: "engineering" },
    { key: "heatLevel", values: heatLevels, fallback: "active" },
    { key: "learningCost", values: learningCosts, fallback: "medium" }
  ],
  relatedIdsKey: "relatedKnowledgeIds",
  duplicateSlugLabel: "技能条目",
  missingRelatedLabel: "知识"
});

export const readSkillWorkspaceStore = workflow.readStore;
export const buildSkillWorkspaceEntries = workflow.buildEntries;
export const getSkillWorkspaceEntries = workflow.getEntries;
export const getSkillWorkspaceEntryById = workflow.getEntryById;
export const evaluateSkillPublishReadiness = workflow.evaluatePublishReadiness;
export const getSkillPublishReadiness = workflow.getPublishReadiness;
export const createSkillWorkspaceRecord = workflow.createRecord;
export const updateSkillWorkspaceRecord = workflow.updateRecord;
export const updateSkillWorkspaceStatus = workflow.updateStatus;
export const applySkillWorkspaceOverlay = workflow.applyOverlay;
export const getMergedPublicSkills = workflow.getMergedPublic;
