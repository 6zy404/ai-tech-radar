"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface ExternalSourceActionsProps {
  sourceId: string;
  enabled: boolean;
  compact?: boolean;
  /** Detail page only: offer 删除信源 (works once the source is disabled). */
  deletable?: { sourceName: string; candidateCount: number };
}

export function ExternalSourceActions({
  sourceId,
  enabled,
  compact = false,
  deletable
}: ExternalSourceActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function updateEnabled(nextEnabled: boolean) {
    if (
      !nextEnabled &&
      !window.confirm("停用这个来源？停用后批量导入会跳过它，直到重新启用。")
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
          throw new Error(result.message ?? "来源更新失败。");
        }

        setMessage(nextEnabled ? "来源已启用。" : "来源已停用。");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "来源更新失败。");
      }
    });
  }

  function deleteSource() {
    if (!deletable || enabled) {
      return;
    }

    if (
      !window.confirm(
        `删除信源「${deletable.sourceName}」？

会删除：这个信源的配置和最近的导入健康记录。
会保留：它导入过的 ${deletable.candidateCount} 条候选，以及由它们发布的信号（来源名照旧显示）。

删除后不能恢复。`
      )
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(`/api/workspace/sources/${sourceId}`, {
          method: "DELETE"
        });
        const result = (await response.json()) as {
          ok: boolean;
          message?: string;
        };

        if (!response.ok || !result.ok) {
          throw new Error(result.message ?? "删除信源失败。");
        }

        router.push("/workspace/sources");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "删除信源失败。");
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
          throw new Error(result.message ?? "来源导入失败。");
        }

        setMessage(
          `${result.status ?? "导入"}：${
            result.message ?? "导入完成。"
          }新增 ${result.candidatesCreated ?? 0} 条，跳过 ${
            result.candidatesSkipped ?? 0
          } 条。`
        );
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "来源导入失败。");
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
              ? "立即从这个来源导入候选内容"
              : "已停用的来源无法导入，请先启用。"
          }
        >
          运行来源导入
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
          {enabled ? "停用来源" : "启用来源"}
        </button>
      </div>
      {!enabled ? (
        <p className="candidate-review-actions__hint">
          该来源已停用，批量导入会跳过它。
        </p>
      ) : null}
      {deletable && !compact ? (
        <div className="source-actions__delete">
          <button
            type="button"
            className="action-button action-button--subtle source-actions__toggle--risk"
            onClick={deleteSource}
            disabled={isPending || enabled}
            aria-describedby={`source-delete-hint-${sourceId}`}
          >
            删除信源
          </button>
          <p
            id={`source-delete-hint-${sourceId}`}
            className="candidate-review-actions__hint"
          >
            {enabled
              ? "只能删除已停用的信源，请先停用。"
              : "只删配置和健康记录；导入过的候选与已发布信号都保留。"}
          </p>
        </div>
      ) : null}
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </div>
  );
}
