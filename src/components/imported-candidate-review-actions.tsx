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
        "拒绝这条导入候选？它会保留在工作台中可供溯源，但不应再转换为技术草稿。"
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
          throw new Error(result.message || "状态更新失败。");
        }

        setMessage(`状态已更新为 ${nextStatus}。`);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "状态更新失败。");
      }
    });
  }

  function convertToDraft() {
    if (!canConvert) {
      setMessage(conversionBlockedMessage ?? "这条候选无法转换。");
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
          throw new Error(result.message || "转换为工作台记录失败。");
        }

        setMessage("已生成技术工作台记录。");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "转换为工作台记录失败。"
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
          标记为已审核
        </button>
        <button
          type="button"
          className="action-button action-button--subtle"
          onClick={() => updateStatus("rejected")}
          disabled={isPending || importStatus === "rejected"}
        >
          拒绝候选
        </button>
        <button
          type="button"
          className="action-button action-button--subtle"
          onClick={() => updateStatus("new")}
          disabled={isPending || importStatus === "new"}
        >
          重置为新候选
        </button>
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={convertToDraft}
          disabled={isPending || !canConvert}
          title={
            canConvert
              ? "创建或更新关联的技术草稿"
              : (conversionBlockedMessage ?? "请先处理重复或状态方面的阻碍")
          }
        >
          {convertedTechnologyId ? "刷新关联技术草稿" : "转换为技术草稿"}
        </button>
      </div>

      <div className="candidate-review-actions__meta">
        {convertedTechnologyId ? (
          <Link
            href={`/workspace/technologies/${convertedTechnologyId}`}
            className="action-link"
          >
            打开工作台记录
          </Link>
        ) : !canConvert && conversionBlockedMessage ? (
          <span className="candidate-review-actions__hint">
            {conversionBlockedMessage}
          </span>
        ) : (
          <span className="candidate-review-actions__hint">
            生成的技术草稿会保持与这条导入候选的关联。
          </span>
        )}
      </div>

      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </section>
  );
}
