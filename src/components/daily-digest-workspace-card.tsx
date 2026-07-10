import Link from "next/link";

import { MetadataRow } from "@/components/metadata-row";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import type { DailyDigest } from "@/types/content";

interface DailyDigestWorkspaceCardProps {
  digest: DailyDigest;
}

function getStatusTone(status: DailyDigest["status"]) {
  if (status === "published") {
    return "success" as const;
  }

  if (status === "archived") {
    return "neutral" as const;
  }

  return "warning" as const;
}

const digestStatusLabels: Record<DailyDigest["status"], string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档"
};

export function DailyDigestWorkspaceCard({
  digest
}: DailyDigestWorkspaceCardProps) {
  return (
    <article className="workspace-record-card digest-workspace-card">
      <div className="candidate-card__meta">
        <div className="candidate-card__meta-row">
          <WorkspaceStatusBadge
            label={digestStatusLabels[digest.status]}
            tone={getStatusTone(digest.status)}
          />
          <span className="candidate-card__source-name">{digest.date}</span>
        </div>
        <MetadataRow
          items={[
            {
              label: "立即关注",
              value: digest.highPriorityTechnologyIds.length
            },
            { label: "值得跟踪", value: digest.watchTechnologyIds.length },
            { label: "来源", value: digest.sourceNames.length },
            { label: "更新于", value: digest.updatedAt.slice(0, 10) },
            { label: "发布于", value: digest.publishedAt?.slice(0, 10) }
          ]}
        />
      </div>

      <div className="candidate-card__body">
        <h2>
          <Link href={`/workspace/digests/${digest.date}`}>{digest.title}</Link>
        </h2>
        <p>{digest.summary}</p>
      </div>

      <div className="digest-workspace-card__links">
        <Link
          href={`/workspace/digests/${digest.date}`}
          className="action-link"
        >
          审核简报
        </Link>
        <Link
          href={`/workspace/digests/${digest.date}/preview`}
          className="action-link"
        >
          预览简报
        </Link>
        {digest.status === "published" ? (
          <Link href={`/digest/${digest.date}`} className="action-link">
            打开已发布简报
          </Link>
        ) : null}
      </div>
    </article>
  );
}
