"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface ImportedCandidateSyncControlsProps {
  syncedAt: string;
  sourceCount: number;
  candidateCount: number;
}

function formatSyncTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function ImportedCandidateSyncControls({
  syncedAt,
  sourceCount,
  candidateCount
}: ImportedCandidateSyncControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function refreshSources() {
    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch("/api/candidates/refresh", {
          method: "POST"
        });
        const result = (await response.json()) as {
          ok: boolean;
          message?: string;
          syncedAt?: string;
        };

        if (!response.ok || !result.ok) {
          throw new Error(result.message || "Source refresh failed.");
        }

        setMessage(
          `Source refresh completed at ${formatSyncTime(
            result.syncedAt ?? syncedAt
          )}.`
        );
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Source refresh failed."
        );
      }
    });
  }

  return (
    <div className="candidate-sync-controls">
      <div className="candidate-sync-controls__meta">
        <strong>{candidateCount} imported candidates</strong>
        <span>{sourceCount} configured sources</span>
        <span>Last sync: {formatSyncTime(syncedAt)}</span>
      </div>

      <div className="candidate-sync-controls__actions">
        <button
          type="button"
          className="action-button"
          onClick={refreshSources}
          disabled={isPending}
        >
          {isPending ? "Refreshing..." : "Refresh Enabled Sources"}
        </button>
        <Link href="/workspace/sources" className="action-link">
          Manage Sources
        </Link>
        <Link href="/workspace/technologies" className="action-link">
          Open Workspace
        </Link>
      </div>

      {message ? (
        <p className="candidate-sync-controls__message">{message}</p>
      ) : null}
    </div>
  );
}
