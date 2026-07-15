import Link from "next/link";

import { MetadataRow } from "@/components/metadata-row";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import type {
  ContentWorkspaceOrigin,
  ContentWorkspaceStatus
} from "@/types/content";

interface ContentWorkspaceEntryCardProps {
  typeLabel: string;
  title: string;
  summary: string;
  status: ContentWorkspaceStatus;
  origin: ContentWorkspaceOrigin;
  meta: { label: string; value: string }[];
  editHref: string;
  publicHref?: string;
}

const originLabels: Record<ContentWorkspaceOrigin, string> = {
  workspace: "工作台新建",
  seed: "内置种子",
  seed_override: "种子已覆盖"
};

export function ContentWorkspaceEntryCard({
  typeLabel,
  title,
  summary,
  status,
  origin,
  meta,
  editHref,
  publicHref
}: ContentWorkspaceEntryCardProps) {
  return (
    <article className="workspace-record-card technology-workspace-record">
      <div className="technology-workspace-record__meta">
        <div className="technology-workspace-record__topline">
          <span className="technology-workspace-record__type">{typeLabel}</span>
        </div>
        <MetadataRow
          items={meta}
          className="technology-workspace-record__metadata"
        />
      </div>

      <div className="technology-workspace-record__body">
        <h2>
          <Link href={editHref}>{title}</Link>
        </h2>
        <p>{summary}</p>
      </div>

      <div className="technology-workspace-record__badges">
        <WorkspaceStatusBadge
          label={status === "published" ? "已发布" : "草稿"}
          tone={status === "published" ? "success" : "info"}
        />
        <span className="info-pill">{originLabels[origin]}</span>
      </div>

      <div className="technology-workspace-record__actions">
        <Link href={editHref} className="action-link">
          编辑条目
        </Link>
        {status === "published" && publicHref ? (
          <Link href={publicHref} className="action-link">
            打开公开页面
          </Link>
        ) : null}
      </div>
    </article>
  );
}
