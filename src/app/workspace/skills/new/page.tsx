import { ContentWorkspaceNewPage } from "@/components/content-workspace-pages";
import { skillWorkspaceKind } from "@/lib/content-workspace-kinds";

export const dynamic = "force-dynamic";

export default function NewWorkspaceSkillPage() {
  return <ContentWorkspaceNewPage kind={skillWorkspaceKind} />;
}
