"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { CandidateImportStatus } from "@/types/content";

interface ImportedCandidateReviewActionsProps {
  candidateId: string;
  importStatus: CandidateImportStatus;
  convertedTechnologyId?: string;
  canConvert?: boolean;
  conversionBlockedMessage?: string;
}

export function ImportedCandidateReviewActions({
  candidateId,
  importStatus,
  convertedTechnologyId,
  canConvert = true,
  conversionBlockedMessage
}: ImportedCandidateReviewActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function updateStatus(nextStatus: CandidateImportStatus) {
    if (
      nextStatus === "rejected" &&
      !window.confirm(
        "Reject this imported candidate? It will stay traceable in the workspace but should not be converted into a technology draft."
      )
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(`/api/candidates/${candidateId}/status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status: nextStatus })
        });
        const result = (await response.json()) as {
          ok: boolean;
          message?: string;
        };

        if (!response.ok || !result.ok) {
          throw new Error(result.message || "Status update failed.");
        }

        setMessage(`Status updated to ${nextStatus}.`);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Status update failed.");
      }
    });
  }

  function convertToDraft() {
    if (!canConvert) {
      setMessage(conversionBlockedMessage ?? "This candidate cannot be converted.");
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(`/api/candidates/${candidateId}/convert`, {
          method: "POST"
        });
        const result = (await response.json()) as {
          ok: boolean;
          draftId?: string;
          message?: string;
        };

        if (!response.ok || !result.ok || !result.draftId) {
          throw new Error(result.message || "Convert to workspace record failed.");
        }

        setMessage("Technology workspace record generated.");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Convert to workspace record failed."
        );
      }
    });
  }

  return (
    <section className="candidate-review-actions">
      <div className="candidate-review-actions__buttons">
        <button
          type="button"
          className="action-button"
          onClick={() => updateStatus("reviewed")}
          disabled={isPending || importStatus === "reviewed"}
        >
          Mark candidate as reviewed
        </button>
        <button
          type="button"
          className="action-button action-button--subtle"
          onClick={() => updateStatus("rejected")}
          disabled={isPending || importStatus === "rejected"}
        >
          Reject candidate
        </button>
        <button
          type="button"
          className="action-button action-button--subtle"
          onClick={() => updateStatus("new")}
          disabled={isPending || importStatus === "new"}
        >
          Reset candidate to new
        </button>
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={convertToDraft}
          disabled={isPending || !canConvert}
          title={
            canConvert
              ? "Create or update the linked technology draft"
              : conversionBlockedMessage ?? "Resolve duplicate or status blockers first"
          }
        >
          {convertedTechnologyId
            ? "Refresh linked technology draft"
            : "Convert to technology draft"}
        </button>
      </div>

      <div className="candidate-review-actions__meta">
        {convertedTechnologyId ? (
          <Link
            href={`/workspace/technologies/${convertedTechnologyId}`}
            className="action-link"
          >
            Open Workspace Record
          </Link>
        ) : !canConvert && conversionBlockedMessage ? (
          <span className="candidate-review-actions__hint">
            {conversionBlockedMessage}
          </span>
        ) : (
          <span className="candidate-review-actions__hint">
            The generated technology draft stays linked to this imported candidate.
          </span>
        )}
      </div>

      {message ? <p className="candidate-review-actions__message">{message}</p> : null}
    </section>
  );
}
