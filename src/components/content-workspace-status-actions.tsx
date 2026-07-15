"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { PublishReadinessResult } from "@/lib/publish-readiness";
import type { ContentWorkspaceStatus } from "@/types/content";

interface ContentWorkspaceStatusActionsProps {
  apiBasePath: string;
  entryId: string;
  status: ContentWorkspaceStatus;
  entityLabel: string;
}

export function ContentWorkspaceStatusActions({
  apiBasePath,
  entryId,
  status,
  entityLabel
}: ContentWorkspaceStatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function updateStatus(nextStatus: ContentWorkspaceStatus) {
    const confirmText =
      nextStatus === "published"
        ? `发布这条${entityLabel}？发布后会出现在公开页面上。`
        : `把这条${entityLabel}撤回为草稿？公开页面将不再显示它。`;

    if (!window.confirm(confirmText)) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(`${apiBasePath}/${entryId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus })
        });
        const result = (await response.json()) as {
          ok: boolean;
          message?: string;
          readiness?: PublishReadinessResult;
        };

        if (!response.ok || !result.ok) {
          const blockingMessages = result.readiness?.blockingErrors
            ?.map((issue) => issue.message)
            .join(" ");

          throw new Error(
            blockingMessages || result.message || "状态更新失败。"
          );
        }

        setMessage(nextStatus === "published" ? "已发布。" : "已撤回为草稿。");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "状态更新失败。");
      }
    });
  }

  return (
    <div className="candidate-review-actions__buttons content-workspace-status-actions">
      {status === "draft" ? (
        <button
          type="button"
          className="action-button action-button--accent"
          disabled={isPending}
          onClick={() => updateStatus("published")}
        >
          发布{entityLabel}
        </button>
      ) : (
        <button
          type="button"
          className="action-button"
          disabled={isPending}
          onClick={() => updateStatus("draft")}
        >
          撤回为草稿
        </button>
      )}
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </div>
  );
}
