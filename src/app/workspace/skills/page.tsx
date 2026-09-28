import { ContentWorkspaceListPage } from "@/components/content-workspace-pages";
import { skillWorkspaceKind } from "@/lib/content-workspace-kinds";

export const dynamic = "force-dynamic";

export default function WorkspaceSkillsPage() {
  return <ContentWorkspaceListPage kind={skillWorkspaceKind} />;
}
