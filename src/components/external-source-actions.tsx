"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface ExternalSourceActionsProps {
  sourceId: string;
  enabled: boolean;
  compact?: boolean;
}

export function ExternalSourceActions({
  sourceId,
  enabled,
  compact = false
}: ExternalSourceActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function updateEnabled(nextEnabled: boolean) {
    if (
      !nextEnabled &&
      !window.confirm(
        "Disable this source? Disabled sources are skipped by batch import until re-enabled."
      )
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(
          `/api/workspace/sources/${sourceId}/enabled`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ enabled: nextEnabled })
          }
        );
        const result = (await response.json()) as {
          ok: boolean;
          message?: string;
        };

        if (!response.ok || !result.ok) {
          throw new Error(result.message ?? "Source update failed.");
        }

        setMessage(nextEnabled ? "Source enabled." : "Source disabled.");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Source update failed."
        );
      }
    });
  }

  function runImport() {
    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(
          `/api/workspace/sources/${sourceId}/import`,
          {
            method: "POST"
          }
        );
        const result = (await response.json()) as {
          ok: boolean;
          message?: string;
          candidates?: unknown[];
          status?: string;
          candidatesCreated?: number;
          candidatesSkipped?: number;
        };

        if (!response.ok || !result.ok) {
          throw new Error(result.message ?? "Source import failed.");
        }

        setMessage(
          `${result.status ?? "Import"}: ${
            result.message ?? "Import completed."
          } Created ${result.candidatesCreated ?? 0}, skipped ${
            result.candidatesSkipped ?? 0
          }.`
        );
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Source import failed."
        );
      }
    });
  }

  return (
    <div
      className={
        compact ? "source-actions source-actions--compact" : "source-actions"
      }
    >
      <div className="candidate-review-actions__buttons">
        <button
          type="button"
          className={
            compact
              ? "action-button action-button--subtle source-actions__import"
              : "action-button action-button--accent source-actions__import"
          }
          onClick={runImport}
          disabled={isPending || !enabled}
          title={
            enabled
              ? "Import candidate content from this source now"
              : "Disabled source cannot be imported. Enable it first."
          }
        >
          Run source import
        </button>
        <button
          type="button"
          className={[
            "action-button",
            "action-button--subtle",
            "source-actions__toggle",
            enabled
              ? "source-actions__toggle--risk"
              : "source-actions__toggle--restore"
          ].join(" ")}
          onClick={() => updateEnabled(!enabled)}
          disabled={isPending}
        >
          {enabled ? "Disable source" : "Enable source"}
        </button>
      </div>
      {!enabled ? (
        <p className="candidate-review-actions__hint">
          This source is disabled and will be skipped by batch import.
        </p>
      ) : null}
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </div>
  );
}
