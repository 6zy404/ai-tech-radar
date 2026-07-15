import Link from "next/link";

import { SkillWorkspaceForm } from "@/components/skill-workspace-form";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getAllKnowledge, getAllTags, getAllTechnologies } from "@/lib/content";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";

export const dynamic = "force-dynamic";

export default function NewWorkspaceSkillPage() {
  const technologyOptions = getAllTechnologies().map((technology) => ({
    id: technology.id,
    title: getPreferredTechnologyTitle(technology)
  }));
  const knowledgeOptions = getAllKnowledge().map((knowledge) => ({
    id: knowledge.id,
    title: knowledge.title
  }));

  return (
    <WorkspacePageShell
      title="新建技能"
      description="创建一条新的技能条目。保存后为草稿，通过发布检查后才会出现在公开页面。"
      sectionLabel="内容管理"
      actions={
        <Link href="/workspace/skills" className="action-link">
          返回技能列表
        </Link>
      }
    >
      <section className="section-panel">
        <SkillWorkspaceForm
          tagOptions={getAllTags()}
          technologyOptions={technologyOptions}
          knowledgeOptions={knowledgeOptions}
        />
      </section>
    </WorkspacePageShell>
  );
}
