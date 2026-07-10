import Link from "next/link";

import { MetadataRow } from "@/components/metadata-row";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import {
  getPriorityLevelClass,
  getPriorityLevelLabel
} from "@/lib/ranking-display";
import type { TechnologyDraft } from "@/types/content";

interface TechnologyDraftCardProps {
  draft: TechnologyDraft;
}

function getDraftDisplayTitle(draft: TechnologyDraft): string {
  return draft.title.zh ?? draft.title.original;
}

function getStatusLabel(status: TechnologyDraft["status"]): string {
  const labels: Record<TechnologyDraft["status"], string> = {
    draft: "草稿",
    published: "已发布",
    archived: "已归档"
  };

  return labels[status];
}

function getStatusTone(
  status: TechnologyDraft["status"]
): "neutral" | "success" | "warning" | "info" {
  if (status === "published") {
    return "success";
  }

  if (status === "archived") {
    return "warning";
  }

  return "info";
}

function getPrimaryActionLabel(status: TechnologyDraft["status"]): string {
  if (status === "draft") {
    return "编辑草稿记录";
  }

  if (status === "published") {
    return "查看已发布记录";
  }

  return "查看已归档记录";
}

export function TechnologyDraftCard({ draft }: TechnologyDraftCardProps) {
  const ranking = evaluateTechnologyPriority(draft);

  return (
    <article className="workspace-record-card technology-workspace-record">
      <div className="technology-workspace-record__meta">
        <div className="technology-workspace-record__topline">
          <span className="technology-workspace-record__type">技术工作台</span>
          <span className="technology-workspace-record__source">
            {draft.publisherName}
          </span>
        </div>
        <MetadataRow
          items={[
            { label: "来源日期", value: draft.publishDate },
            { label: "类型", value: draft.type },
            { label: "更新于", value: draft.updatedAt.slice(0, 10) },
            { label: "技能", value: String(draft.relatedSkillIds.length) },
            {
              label: "知识",
              value: String(draft.relatedKnowledgeIds.length)
            }
          ]}
          className="technology-workspace-record__metadata"
        />
      </div>

      <div className="technology-workspace-record__body">
        <h2>
          <Link href={`/workspace/technologies/${draft.id}`}>
            {getDraftDisplayTitle(draft)}
          </Link>
        </h2>
        <p>{draft.summary.zh ?? draft.summary.original}</p>
      </div>

      <div className="technology-workspace-record__badges">
        <WorkspaceStatusBadge
          label={getStatusLabel(draft.status)}
          tone={getStatusTone(draft.status)}
        />
        <span className={getPriorityLevelClass(ranking.priorityLevel)}>
          {getPriorityLevelLabel(ranking.priorityLevel, "zh")}
        </span>
        <span className="info-pill">{draft.sourceLanguage.toUpperCase()}</span>
      </div>

      <div className="technology-workspace-record__actions">
        <Link
          href={`/workspace/technologies/${draft.id}`}
          className="action-link"
        >
          {getPrimaryActionLabel(draft.status)}
        </Link>
        <Link
          href={`/workspace/technologies/${draft.id}/preview`}
          className="action-link"
        >
          预览用户端效果
        </Link>
        {draft.status === "published" ? (
          <Link href={`/technologies/${draft.slug}`} className="action-link">
            打开公开页面
          </Link>
        ) : null}
      </div>
    </article>
  );
}
