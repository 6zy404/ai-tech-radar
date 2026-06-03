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

export function DailyDigestWorkspaceCard({
  digest
}: DailyDigestWorkspaceCardProps) {
  return (
    <article className="workspace-record-card digest-workspace-card">
      <div className="candidate-card__meta">
        <div className="candidate-card__meta-row">
          <WorkspaceStatusBadge
            label={digest.status}
            tone={getStatusTone(digest.status)}
          />
          <span className="candidate-card__source-name">{digest.date}</span>
        </div>
        <MetadataRow
          items={[
            {
              label: "Immediate",
              value: digest.highPriorityTechnologyIds.length
            },
            { label: "Watch", value: digest.watchTechnologyIds.length },
            { label: "Sources", value: digest.sourceNames.length },
            { label: "Updated", value: digest.updatedAt.slice(0, 10) },
            { label: "Published", value: digest.publishedAt?.slice(0, 10) }
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
        <Link href={`/workspace/digests/${digest.date}`} className="action-link">
          Review
        </Link>
        <Link
          href={`/workspace/digests/${digest.date}/preview`}
          className="action-link"
        >
          Preview
        </Link>
        {digest.status === "published" ? (
          <Link href={`/digest/${digest.date}`} className="action-link">
            Open published
          </Link>
        ) : null}
      </div>
    </article>
  );
}
