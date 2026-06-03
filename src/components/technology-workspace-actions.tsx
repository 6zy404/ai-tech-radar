"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { PublishReadinessResult } from "@/lib/publish-readiness";
import type { TechnologyStatus } from "@/types/content";

interface TechnologyWorkspaceActionsProps {
  recordId: string;
  status: TechnologyStatus;
  readiness: PublishReadinessResult;
}

export function TechnologyWorkspaceActions({
  recordId,
  status,
  readiness
}: TechnologyWorkspaceActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function updateStatus(nextStatus: TechnologyStatus) {
    if (
      nextStatus === "published" &&
      !window.confirm(
        "Publish this technology record to the user-facing product? Readiness checks must pass first."
      )
    ) {
      return;
    }

    if (
      nextStatus === "archived" &&
      !window.confirm(
        "Archive this technology record? It will no longer be treated as an active public technology signal."
      )
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(`/api/workspace/technologies/${recordId}/status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status: nextStatus })
        });
        const result = (await response.json()) as {
          ok: boolean;
          message?: string;
          readiness?: PublishReadinessResult;
        };

        if (!response.ok || !result.ok) {
          const readinessMessage =
            result.readiness && result.readiness.blockingErrors.length > 0
              ? result.readiness.blockingErrors
                  .map((issue) => issue.message)
                  .join(" ")
              : "";

          throw new Error(
            [result.message, readinessMessage]
              .filter((value): value is string => Boolean(value))
              .join(" ") || "Technology workspace update failed."
          );
        }

        setMessage(
          nextStatus === "published" && result.readiness?.warnings.length
            ? `Record published with ${result.readiness.warnings.length} warning(s).`
            : `Record status updated to ${nextStatus}.`
        );
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Technology workspace update failed."
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
          disabled={isPending || status === "published" || !readiness.isReady}
          title={
            readiness.isReady
              ? "Publish this technology record"
              : "Resolve blocking readiness errors before publishing"
          }
        >
          Publish technology
        </button>
        <button
          type="button"
          className="action-button action-button--subtle"
          onClick={() => updateStatus("draft")}
          disabled={isPending || status === "draft"}
        >
          Move technology back to draft
        </button>
        <button
          type="button"
          className="action-button action-button--subtle"
          onClick={() => updateStatus("archived")}
          disabled={isPending || status === "archived"}
        >
          Archive technology
        </button>
      </div>

      {message ? <p className="candidate-review-actions__message">{message}</p> : null}
      {!readiness.isReady ? (
        <p className="candidate-review-actions__message">
          Publishing is blocked until the readiness errors are fixed.
        </p>
      ) : readiness.warnings.length > 0 ? (
        <p className="candidate-review-actions__message">
          Publishing is allowed, but {readiness.warnings.length} warning(s) should be
          reviewed first.
        </p>
      ) : null}
    </section>
  );
}
