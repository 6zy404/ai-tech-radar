"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { DuplicateGroupStatus, ImportedCandidate } from "@/types/content";

interface DuplicateGroupActionsProps {
  groupId: string;
  primaryCandidateId: string;
  status: DuplicateGroupStatus;
  candidates: ImportedCandidate[];
}

export function DuplicateGroupActions({
  groupId,
  primaryCandidateId,
  status,
  candidates
}: DuplicateGroupActionsProps) {
  const router = useRouter();
  const [selectedPrimaryId, setSelectedPrimaryId] =
    useState(primaryCandidateId);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateGroup(body: {
    primaryCandidateId?: string;
    status?: DuplicateGroupStatus;
  }) {
    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(`/api/workspace/duplicates/${groupId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });
        const result = (await response.json()) as {
          ok: boolean;
          message?: string;
        };

        if (!response.ok || !result.ok) {
          throw new Error(result.message || "Duplicate group update failed.");
        }

        setMessage("Duplicate group updated.");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Duplicate group update failed."
        );
      }
    });
  }

  return (
    <section className="candidate-review-actions duplicate-review-actions">
      <label className="field duplicate-review-actions__primary">
        <span>Primary candidate</span>
        <select
          value={selectedPrimaryId}
          onChange={(event) => setSelectedPrimaryId(event.target.value)}
          disabled={isPending}
        >
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.originalTitle}
            </option>
          ))}
        </select>
      </label>

      <div className="candidate-review-actions__buttons">
        <button
          type="button"
          className="action-button"
          onClick={() => updateGroup({ primaryCandidateId: selectedPrimaryId })}
          disabled={isPending || selectedPrimaryId === primaryCandidateId}
        >
          Set Primary
        </button>
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={() =>
            updateGroup({
              primaryCandidateId: selectedPrimaryId,
              status: "resolved"
            })
          }
          disabled={isPending || status === "resolved"}
        >
          Resolve Group
        </button>
        <button
          type="button"
          className="action-button action-button--subtle"
          onClick={() => updateGroup({ status: "ignored" })}
          disabled={isPending || status === "ignored"}
        >
          Ignore
        </button>
        <button
          type="button"
          className="action-button action-button--subtle"
          onClick={() => updateGroup({ status: "open" })}
          disabled={isPending || status === "open"}
        >
          Reopen
        </button>
      </div>

      <p className="candidate-review-actions__hint">
        Only the primary candidate should be converted into a technology draft.
        Other items are preserved as source references.
      </p>
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </section>
  );
}
