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
        "生成或重新生成今日简报草稿？已有的手动添加、排除、置顶、排序、编辑概览和备注都会保留。"
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
          throw new Error(result.message ?? "简报生成失败。");
        }

        setMessage("简报已生成。已有的手动调整会被保留。");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "简报生成失败。");
      }
    });
  }

  return (
    <section className="source-batch-panel digest-workspace-actions">
      <div>
        <p className="eyebrow">每日简报</p>
        <h2>生成简报草稿</h2>
        <p>
          基于已发布技术记录和 Ranking v0
          优先级生成草稿简报。已有的手动添加、排除、置顶、排序和编辑概览会被保留。
        </p>
      </div>
      <div className="source-batch-panel__actions">
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={generateDigest}
          disabled={isPending}
        >
          {isPending ? "正在生成简报草稿…" : "生成简报草稿"}
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
        "把这期简报发布到公开简报页和订阅源？发布前必须先通过就绪检查。"
      )
    ) {
      return;
    }

    if (
      nextStatus === "archived" &&
      !window.confirm("归档这期简报？归档的简报默认不会公开投递。")
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
            blockingSummary || result.message || "简报状态更新失败。"
          );
        }

        setMessage(`简报状态已更新为 ${nextStatus}。`);
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "简报状态更新失败。"
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
          发布简报
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
          归档简报
        </button>
      </div>
      {readiness && !readiness.isReady ? (
        <p className="candidate-review-actions__hint">
          修复简报就绪检查中的阻塞错误后才能发布。
        </p>
      ) : null}
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </section>
  );
}
