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
  return `${status.slice(0, 1).toUpperCase()}${status.slice(1)}`;
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
    return "Edit draft record";
  }

  if (status === "published") {
    return "Inspect published record";
  }

  return "Inspect archived record";
}

export function TechnologyDraftCard({ draft }: TechnologyDraftCardProps) {
  const ranking = evaluateTechnologyPriority(draft);

  return (
    <article className="workspace-record-card technology-workspace-record">
      <div className="technology-workspace-record__meta">
        <div className="technology-workspace-record__topline">
          <span className="technology-workspace-record__type">
            Technology Workspace
          </span>
          <span className="technology-workspace-record__source">
            {draft.publisherName}
          </span>
        </div>
        <MetadataRow
          items={[
            { label: "Source date", value: draft.publishDate },
            { label: "Type", value: draft.type },
            { label: "Updated", value: draft.updatedAt.slice(0, 10) },
            { label: "Skills", value: String(draft.relatedSkillIds.length) },
            {
              label: "Knowledge",
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
          {getPriorityLevelLabel(ranking.priorityLevel)}
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
          Preview workspace copy
        </Link>
        {draft.status === "published" ? (
          <Link href={`/technologies/${draft.slug}`} className="action-link">
            Open public page
          </Link>
        ) : null}
      </div>
    </article>
  );
}
