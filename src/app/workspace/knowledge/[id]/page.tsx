import { ContentWorkspaceDetailPage } from "@/components/content-workspace-pages";
import { knowledgeWorkspaceKind } from "@/lib/content-workspace-kinds";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspaceKnowledgeDetailPage({
  params
}: PageProps) {
  const { id } = await params;

  return <ContentWorkspaceDetailPage kind={knowledgeWorkspaceKind} id={id} />;
}
