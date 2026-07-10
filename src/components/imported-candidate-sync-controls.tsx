"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface ImportedCandidateSyncControlsProps {
  syncedAt: string;
  sourceCount: number;
  candidateCount: number;
}

function formatSyncTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function ImportedCandidateSyncControls({
  syncedAt,
  sourceCount,
  candidateCount
}: ImportedCandidateSyncControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function refreshSources() {
    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch("/api/candidates/refresh", {
          method: "POST"
        });
        const result = (await response.json()) as {
          ok: boolean;
          message?: string;
          syncedAt?: string;
        };

        if (!response.ok || !result.ok) {
          throw new Error(result.message || "来源刷新失败。");
        }

        setMessage(
          `来源刷新完成于 ${formatSyncTime(result.syncedAt ?? syncedAt)}。`
        );
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "来源刷新失败。");
      }
    });
  }

  return (
    <div className="candidate-sync-controls">
      <div className="candidate-sync-controls__meta">
        <strong>{candidateCount} 条导入候选</strong>
        <span>{sourceCount} 个已配置来源</span>
        <span>最近同步：{formatSyncTime(syncedAt)}</span>
      </div>

      <div className="candidate-sync-controls__actions">
        <button
          type="button"
          className="action-button"
          onClick={refreshSources}
          disabled={isPending}
        >
          {isPending ? "正在刷新…" : "刷新已启用来源"}
        </button>
        <Link href="/workspace/sources" className="action-link">
          管理来源
        </Link>
        <Link href="/workspace/technologies" className="action-link">
          打开草稿列表
        </Link>
      </div>

      {message ? (
        <p className="candidate-sync-controls__message">{message}</p>
      ) : null}
    </div>
  );
}
