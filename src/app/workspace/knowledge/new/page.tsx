import Link from "next/link";

import { KnowledgeWorkspaceForm } from "@/components/knowledge-workspace-form";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getAllSkills, getAllTags, getAllTechnologies } from "@/lib/content";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";

export const dynamic = "force-dynamic";

export default function NewWorkspaceKnowledgePage() {
  const technologyOptions = getAllTechnologies().map((technology) => ({
    id: technology.id,
    title: getPreferredTechnologyTitle(technology)
  }));
  const skillOptions = getAllSkills().map((skill) => ({
    id: skill.id,
    title: skill.title
  }));

  return (
    <WorkspacePageShell
      title="新建知识条目"
      description="创建一条新的知识条目。保存后为草稿，通过发布检查后才会出现在公开页面。"
      sectionLabel="内容管理"
      actions={
        <Link href="/workspace/knowledge" className="action-link">
          返回知识列表
        </Link>
      }
    >
      <section className="section-panel">
        <KnowledgeWorkspaceForm
          tagOptions={getAllTags()}
          technologyOptions={technologyOptions}
          skillOptions={skillOptions}
        />
      </section>
    </WorkspacePageShell>
  );
}
