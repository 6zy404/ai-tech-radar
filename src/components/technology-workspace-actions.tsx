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
        "把这条技术记录发布到用户产品？发布前必须先通过就绪检查。"
      )
    ) {
      return;
    }

    if (
      nextStatus === "archived" &&
      !window.confirm("归档这条技术记录？它将不再作为活跃的公开技术信号。")
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(
          `/api/workspace/technologies/${recordId}/status`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: nextStatus })
          }
        );
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
              .join(" ") || "技术工作台更新失败。"
          );
        }

        setMessage(
          nextStatus === "published" && result.readiness?.warnings.length
            ? `记录已发布，附带 ${result.readiness.warnings.length} 条警告。`
            : `记录状态已更新为 ${nextStatus}。`
        );
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "技术工作台更新失败。"
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
              ? "发布这条技术记录"
              : "发布前请先解决阻塞性就绪错误"
          }
        >
          发布技术
        </button>
        <button
          type="button"
          className="action-button action-button--subtle"
          onClick={() => updateStatus("draft")}
          disabled={isPending || status === "draft"}
        >
          退回草稿
        </button>
        <button
          type="button"
          className="action-button action-button--subtle"
          onClick={() => updateStatus("archived")}
          disabled={isPending || status === "archived"}
        >
          归档技术
        </button>
      </div>

      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
      {!readiness.isReady ? (
        <p className="candidate-review-actions__message">
          修复就绪检查中的阻塞错误后才能发布。
        </p>
      ) : readiness.warnings.length > 0 ? (
        <p className="candidate-review-actions__message">
          可以发布，但建议先复查 {readiness.warnings.length} 条警告。
        </p>
      ) : null}
    </section>
  );
}
