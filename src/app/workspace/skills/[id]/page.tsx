import { ContentWorkspaceDetailPage } from "@/components/content-workspace-pages";
import { skillWorkspaceKind } from "@/lib/content-workspace-kinds";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspaceSkillDetailPage({ params }: PageProps) {
  const { id } = await params;

  return <ContentWorkspaceDetailPage kind={skillWorkspaceKind} id={id} />;
}
