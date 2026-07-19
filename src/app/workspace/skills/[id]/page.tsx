import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentWorkspaceStatusActions } from "@/components/content-workspace-status-actions";
import { PublishReadinessPanel } from "@/components/publish-readiness-panel";
import { SkillWorkspaceForm } from "@/components/skill-workspace-form";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getAllKnowledge, getAllTags, getAllTechnologies } from "@/lib/content";
import { buildRelationDefaults } from "@/lib/link-relation-workflow";
import {
  getSkillPublishReadiness,
  getSkillWorkspaceEntryById
} from "@/lib/skill-workflow";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const originNotes = {
  workspace: "工作台新建条目。",
  seed: "内置种子条目。保存编辑后会复制为工作台版本，种子代码文件不受影响。",
  seed_override: "种子条目已被工作台版本覆盖，以此处的内容为准。"
} as const;

export default async function WorkspaceSkillDetailPage({ params }: PageProps) {
  const { id } = await params;
  const entry = getSkillWorkspaceEntryById(id);

  if (!entry) {
    notFound();
  }

  const readiness = getSkillPublishReadiness(id);
  const technologyOptions = getAllTechnologies().map((technology) => ({
    id: technology.id,
    title: getPreferredTechnologyTitle(technology)
  }));
  const knowledgeOptions = getAllKnowledge().map((knowledge) => ({
    id: knowledge.id,
    title: knowledge.title
  }));
  const relationDefaults = buildRelationDefaults(
    { id: entry.item.id, type: "skill" },
    [
      ...technologyOptions.map((option) => ({
        id: option.id,
        type: "technology" as const
      })),
      ...knowledgeOptions.map((option) => ({
        id: option.id,
        type: "knowledge" as const
      }))
    ]
  );

  return (
    <WorkspacePageShell
      title={entry.item.title || "未命名技能"}
      description={originNotes[entry.origin]}
      sectionLabel="技能编辑"
      actions={
        <>
          {entry.status === "published" ? (
            <Link href={`/skills/${entry.item.slug}`} className="action-link">
              打开公开页面
            </Link>
          ) : null}
          <Link href="/workspace/skills" className="action-link">
            返回技能列表
          </Link>
        </>
      }
    >
      <section className="section-panel">
        <div className="workspace-technology-section__header">
          <div>
            <p className="workspace-technology-section__eyebrow">状态</p>
            <h2>{entry.status === "published" ? "已发布" : "草稿"}</h2>
          </div>
          <ContentWorkspaceStatusActions
            apiBasePath="/api/workspace/skills"
            entryId={entry.item.id}
            status={entry.status}
            entityLabel="技能"
          />
        </div>
      </section>

      <PublishReadinessPanel readiness={readiness} />

      <section className="section-panel">
        <SkillWorkspaceForm
          skill={entry.item}
          tagOptions={getAllTags()}
          technologyOptions={technologyOptions}
          knowledgeOptions={knowledgeOptions}
          relationDefaults={relationDefaults}
        />
      </section>
    </WorkspacePageShell>
  );
}
