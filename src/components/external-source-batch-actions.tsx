"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ImportRun } from "@/types/content";

interface ExternalSourceBatchActionsProps {
  latestImportRun?: ImportRun;
}

interface BatchImportResponse {
  ok: boolean;
  message?: string;
  run?: ImportRun;
}

function formatDateTime(value: string | undefined): string {
  return value ? value.slice(0, 16).replace("T", " ") : "未运行";
}

const runStatusLabels: Record<string, string> = {
  success: "成功",
  failed: "失败",
  partial: "部分成功"
};

export function ExternalSourceBatchActions({
  latestImportRun
}: ExternalSourceBatchActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [activeRun, setActiveRun] = useState<ImportRun | undefined>(
    latestImportRun
  );

  function runBatchImport() {
    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch("/api/workspace/sources/import", {
          method: "POST"
        });
        const result = (await response.json()) as BatchImportResponse;

        if (!response.ok || !result.ok || !result.run) {
          throw new Error(result.message ?? "批量导入失败。");
        }

        setActiveRun(result.run);
        setMessage("批量导入完成。");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "批量导入失败。");
      }
    });
  }

  return (
    <section className="source-batch-panel">
      <div>
        <p className="eyebrow">批量导入</p>
        <h2>导入全部已启用来源</h2>
        <p>
          每个已启用来源独立运行。停用的来源会被跳过；失败的来源会被记录，但不会中断整轮导入。
        </p>
      </div>

      <div className="source-batch-panel__actions">
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={runBatchImport}
          disabled={isPending}
        >
          {isPending ? "正在导入已启用来源…" : "导入已启用来源"}
        </button>
        {message ? (
          <p className="candidate-review-actions__message">{message}</p>
        ) : null}
      </div>

      {activeRun ? (
        <div className="source-batch-summary">
          <span>
            状态：{runStatusLabels[activeRun.status] ?? activeRun.status}
          </span>
          <span>来源总数：{activeRun.totalSources}</span>
          <span>已启用：{activeRun.enabledSources}</span>
          <span>成功：{activeRun.successfulSources}</span>
          <span>部分成功：{activeRun.partialSources}</span>
          <span>失败：{activeRun.failedSources}</span>
          <span>新增：{activeRun.totalCandidatesCreated}</span>
          <span>跳过：{activeRun.totalCandidatesSkipped}</span>
          <span>完成时间：{formatDateTime(activeRun.finishedAt)}</span>
        </div>
      ) : (
        <p className="source-batch-panel__empty">
          还没有运行过批量导入。运行时会自动跳过停用的来源。
        </p>
      )}
    </section>
  );
}
