import { createContentWorkspaceRoutes } from "@/app/api/workspace/content-workspace-routes";
import { heatLevels, learningCosts, skillTypes } from "@/lib/content-labels";
import {
  createSkillWorkspaceRecord,
  getSkillPublishReadiness,
  getSkillWorkspaceEntryById,
  updateSkillWorkspaceRecord,
  updateSkillWorkspaceStatus
} from "@/lib/skill-workflow";
import type { SkillItem } from "@/types/content";

export const skillRoutes = createContentWorkspaceRoutes<SkillItem>({
  label: "skill",
  workspacePath: "/workspace/skills",
  publicPath: "/skills",
  enums: {
    skillType: skillTypes,
    heatLevel: heatLevels,
    learningCost: learningCosts
  },
  relatedIdsKey: "relatedKnowledgeIds",
  getEntryById: getSkillWorkspaceEntryById,
  getPublishReadiness: getSkillPublishReadiness,
  createRecord: createSkillWorkspaceRecord,
  updateRecord: updateSkillWorkspaceRecord,
  updateStatus: updateSkillWorkspaceStatus
});
