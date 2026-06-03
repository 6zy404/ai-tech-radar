import Link from "next/link";

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
): "neutral" | "success" | "warning" {
  if (status === "published") {
    return "success";
  }

  if (status === "archived") {
    return "warning";
  }

  return "neutral";
}

export function TechnologyDraftCard({ draft }: TechnologyDraftCardProps) {
  const ranking = evaluateTechnologyPriority(draft);

  return (
    <article className="candidate-card workspace-record-card">
      <div className="candidate-card__meta">
        <div className="candidate-card__meta-row">
          <span className="candidate-card__source-type">Technology Workspace</span>
          <span className="candidate-card__source-name">{draft.publisherName}</span>
        </div>
        <div className="candidate-card__meta-row candidate-card__meta-row--muted">
          <span>{draft.publishDate}</span>
          <span>{draft.type}</span>
        </div>
      </div>

      <div className="candidate-card__body">
        <h2>
          <Link href={`/workspace/technologies/${draft.id}`}>
            {getDraftDisplayTitle(draft)}
          </Link>
        </h2>
        <p>{draft.summary.zh ?? draft.summary.original}</p>
      </div>

      <div className="candidate-card__badges">
        <WorkspaceStatusBadge
          label={getStatusLabel(draft.status)}
          tone={getStatusTone(draft.status)}
        />
        <span className={getPriorityLevelClass(ranking.priorityLevel)}>
          {getPriorityLevelLabel(ranking.priorityLevel)}
        </span>
        <span className="info-pill">{draft.sourceLanguage.toUpperCase()}</span>
      </div>

      <div className="workspace-record-card__actions">
        <Link href={`/workspace/technologies/${draft.id}`} className="action-link">
          Open detail / edit draft
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
