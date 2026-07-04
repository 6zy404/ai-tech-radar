"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  DailyDigest,
  DailyDigestStatus,
  DigestPublishReadiness
} from "@/types/content";

interface GenerateDigestActionProps {
  date: string;
}

interface DailyDigestStatusActionsProps {
  date: string;
  status: DailyDigestStatus;
  readiness?: DigestPublishReadiness;
}

interface DigestResponse {
  ok: boolean;
  message?: string;
  digest?: DailyDigest;
  readiness?: DigestPublishReadiness;
}

export function GenerateDigestAction({ date }: GenerateDigestActionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function generateDigest() {
    if (
      !window.confirm(
        "Generate or regenerate today's digest draft? Existing manual add, exclude, pin, order, editorial summary, and notes are preserved."
      )
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch("/api/workspace/digests/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ date })
        });
        const result = (await response.json()) as DigestResponse;

        if (!response.ok || !result.ok) {
          throw new Error(result.message ?? "Digest generation failed.");
        }

        setMessage(
          "Digest generated. Existing manual adjustments are preserved when present."
        );
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Digest generation failed."
        );
      }
    });
  }

  return (
    <section className="source-batch-panel digest-workspace-actions">
      <div>
        <p className="eyebrow">Daily Digest</p>
        <h2>Generate digest draft</h2>
        <p>
          Builds a draft digest from published TechnologyItem records and
          Ranking v0 priority levels. Existing manual add, exclude, pin, order,
          and editorial summary edits are preserved.
        </p>
      </div>
      <div className="source-batch-panel__actions">
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={generateDigest}
          disabled={isPending}
        >
          {isPending ? "Generating digest draft..." : "Generate digest draft"}
        </button>
        {message ? (
          <p className="candidate-review-actions__message">{message}</p>
        ) : null}
      </div>
    </section>
  );
}

export function DailyDigestStatusActions({
  date,
  status,
  readiness
}: DailyDigestStatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function updateStatus(nextStatus: DailyDigestStatus) {
    if (
      nextStatus === "published" &&
      !window.confirm(
        "Publish this digest to public digest pages and feeds? Readiness checks must pass first."
      )
    ) {
      return;
    }

    if (
      nextStatus === "archived" &&
      !window.confirm(
        "Archive this digest? Archived digests are not publicly delivered by default."
      )
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(`/api/workspace/digests/${date}/status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status: nextStatus })
        });
        const result = (await response.json()) as DigestResponse;

        if (!response.ok || !result.ok) {
          const blockingSummary = result.readiness?.blockingErrors
            .map((issue) => issue.message)
            .join(" ");

          throw new Error(
            blockingSummary || result.message || "Digest status update failed."
          );
        }

        setMessage(`Digest moved to ${nextStatus}.`);
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Digest status update failed."
        );
      }
    });
  }

  return (
    <section className="candidate-review-actions">
      <div className="candidate-review-actions__buttons">
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={() => updateStatus("published")}
          disabled={
            isPending ||
            status === "published" ||
            (readiness ? !readiness.isReady : false)
          }
        >
          Publish digest
        </button>
        <button
          type="button"
          className="action-button action-button--subtle"
          onClick={() => updateStatus("draft")}
          disabled={isPending || status === "draft"}
        >
          Move to draft
        </button>
        <button
          type="button"
          className="action-button action-button--subtle"
          onClick={() => updateStatus("archived")}
          disabled={isPending || status === "archived"}
        >
          Archive digest
        </button>
      </div>
      {readiness && !readiness.isReady ? (
        <p className="candidate-review-actions__hint">
          Publishing is disabled until blocking digest readiness errors are
          fixed.
        </p>
      ) : null}
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </section>
  );
}
