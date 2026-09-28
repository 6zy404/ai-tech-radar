import { createContentWorkspaceRoutes } from "@/app/api/workspace/content-workspace-routes";
import { difficultyLevels, knowledgeCategories } from "@/lib/content-labels";
import {
  createKnowledgeWorkspaceRecord,
  getKnowledgePublishReadiness,
  getKnowledgeWorkspaceEntryById,
  updateKnowledgeWorkspaceRecord,
  updateKnowledgeWorkspaceStatus
} from "@/lib/knowledge-workflow";
import type { KnowledgeItem } from "@/types/content";

export const knowledgeRoutes = createContentWorkspaceRoutes<KnowledgeItem>({
  label: "knowledge",
  workspacePath: "/workspace/knowledge",
  publicPath: "/knowledge",
  enums: { category: knowledgeCategories, difficulty: difficultyLevels },
  relatedIdsKey: "relatedSkillIds",
  getEntryById: getKnowledgeWorkspaceEntryById,
  getPublishReadiness: getKnowledgePublishReadiness,
  createRecord: createKnowledgeWorkspaceRecord,
  updateRecord: updateKnowledgeWorkspaceRecord,
  updateStatus: updateKnowledgeWorkspaceStatus
});
