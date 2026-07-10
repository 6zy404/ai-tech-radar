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
          throw new Error(result.message || "重复组更新失败。");
        }

        setMessage("重复组已更新。");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "重复组更新失败。");
      }
    });
  }

  return (
    <section className="candidate-review-actions duplicate-review-actions">
      <label className="field duplicate-review-actions__primary">
        <span>主候选</span>
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
          设为主候选
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
          解决重复组
        </button>
        <button
          type="button"
          className="action-button action-button--subtle"
          onClick={() => updateGroup({ status: "ignored" })}
          disabled={isPending || status === "ignored"}
        >
          忽略
        </button>
        <button
          type="button"
          className="action-button action-button--subtle"
          onClick={() => updateGroup({ status: "open" })}
          disabled={isPending || status === "open"}
        >
          重新打开
        </button>
      </div>

      <p className="candidate-review-actions__hint">
        只有主候选应被转换为技术草稿，其余条目会保留为来源引用。
      </p>
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </section>
  );
}
