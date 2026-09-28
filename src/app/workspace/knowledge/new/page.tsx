import { ContentWorkspaceNewPage } from "@/components/content-workspace-pages";
import { knowledgeWorkspaceKind } from "@/lib/content-workspace-kinds";

export const dynamic = "force-dynamic";

export default function NewWorkspaceKnowledgePage() {
  return <ContentWorkspaceNewPage kind={knowledgeWorkspaceKind} />;
}
