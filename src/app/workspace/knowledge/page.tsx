import { ContentWorkspaceListPage } from "@/components/content-workspace-pages";
import { knowledgeWorkspaceKind } from "@/lib/content-workspace-kinds";

export const dynamic = "force-dynamic";

export default function WorkspaceKnowledgePage() {
  return <ContentWorkspaceListPage kind={knowledgeWorkspaceKind} />;
}
