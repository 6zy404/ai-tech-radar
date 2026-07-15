import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentWorkspaceStatusActions } from "@/components/content-workspace-status-actions";
import { KnowledgeWorkspaceForm } from "@/components/knowledge-workspace-form";
import { PublishReadinessPanel } from "@/components/publish-readiness-panel";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getAllSkills, getAllTags, getAllTechnologies } from "@/lib/content";
import {
  getKnowledgePublishReadiness,
  getKnowledgeWorkspaceEntryById
} from "@/lib/knowledge-workflow";
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

export default async function WorkspaceKnowledgeDetailPage({
  params
}: PageProps) {
  const { id } = await params;
  const entry = getKnowledgeWorkspaceEntryById(id);

  if (!entry) {
    notFound();
  }

  const readiness = getKnowledgePublishReadiness(id);
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
      title={entry.item.title || "未命名知识条目"}
      description={originNotes[entry.origin]}
      sectionLabel="知识编辑"
      actions={
        <>
          {entry.status === "published" ? (
            <Link
              href={`/knowledge/${entry.item.slug}`}
              className="action-link"
            >
              打开公开页面
            </Link>
          ) : null}
          <Link href="/workspace/knowledge" className="action-link">
            返回知识列表
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
            apiBasePath="/api/workspace/knowledge"
            entryId={entry.item.id}
            status={entry.status}
            entityLabel="知识条目"
          />
        </div>
      </section>

      <PublishReadinessPanel readiness={readiness} />

      <section className="section-panel">
        <KnowledgeWorkspaceForm
          knowledge={entry.item}
          tagOptions={getAllTags()}
          technologyOptions={technologyOptions}
          skillOptions={skillOptions}
        />
      </section>
    </WorkspacePageShell>
  );
}
