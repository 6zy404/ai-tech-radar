"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PushRunSummary } from "@/lib/push-dispatch";

interface PushWorkspaceActionsProps {
  defaultDate: string;
  enabled: boolean;
}

async function postPush(
  date: string,
  dryRun: boolean
): Promise<
  { ok: true; summary: PushRunSummary } | { ok: false; message: string }
> {
  try {
    const response = await fetch("/api/workspace/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, dryRun })
    });
    const data = (await response.json()) as
      { ok: true; summary: PushRunSummary } | { ok: false; message: string };

    return data;
  } catch {
    return { ok: false, message: "请求失败。" };
  }
}

// Workspace-only. Counts first (a dry run), then a confirm naming who would
// be notified, then the send — the same confirm-before-external-send rule as
// the digest delivery actions (docs/workspace-actions.md).
export function PushWorkspaceActions({
  defaultDate,
  enabled
}: PushWorkspaceActionsProps) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const handlePush = async () => {
    setBusy(true);
    setMessage("");

    const preview = await postPush(date, true);

    if (!preview.ok) {
      setBusy(false);
      setMessage(preview.message);
      return;
    }

    const { summary } = preview;

    if (summary.plannedCount === 0) {
      setBusy(false);
      setMessage(
        summary.candidateSignalCount === 0
          ? `${date} 没有待推送的新信号${summary.alreadyPushedSignalCount ? `（${summary.alreadyPushedSignalCount} 条已推送过）` : ""}。`
          : `${date} 的 ${summary.candidateSignalCount} 条新信号没有命中任何订阅者的关注话题。`
      );
      return;
    }

    if (
      !window.confirm(
        `把 ${date} 发布的 ${summary.candidateSignalCount} 条新信号推送给 ${summary.plannedCount} 位订阅者（每人一条合并通知）？推送后这些信号不会再推。`
      )
    ) {
      setBusy(false);
      return;
    }

    const result = await postPush(date, false);

    setBusy(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    const { failures } = result.summary;
    const failureText =
      failures.length > 0
        ? ` 失败明细：${failures
            .map((entry) => `${entry.service} ${entry.reason} × ${entry.count}`)
            .join("；")}。`
        : "";
    // Every send failing on a timeout or refused connection almost always
    // means this server is not using the proxy (it was started without
    // `npm run dev` / `npm run start`, which wrap it in with-proxy-env).
    const looksLikeNoProxy =
      result.summary.sentCount === 0 &&
      failures.length > 0 &&
      failures.every((entry) =>
        /Timeout|TIMEOUT|ECONN|ENOTFOUND|TypeError/.test(entry.reason)
      );

    setMessage(
      `已发送 ${result.summary.sentCount} 条，失败 ${result.summary.failedCount} 条；删除失效订阅 ${result.summary.expiredRemovedCount} 个；${result.summary.pushedSignalCount} 条信号记为已推送。${failureText}${
        looksLikeNoProxy
          ? " 全部连不上推送服务：本机直连这些服务会超时，确认这个服务器是用 npm run dev / npm run start 启动的（它们会走代理）。未送达的信号没有记为已推送，可以重推。"
          : ""
      }`
    );
    router.refresh();
  };

  return (
    <div className="push-workspace-actions">
      <label>
        发布日期
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          disabled={busy}
        />
      </label>
      <button
        type="button"
        className="action-button action-button--accent"
        onClick={handlePush}
        disabled={busy || !enabled || !date}
      >
        {busy ? "处理中…" : "推送新信号"}
      </button>
      {message ? (
        <p className="push-workspace-actions__message" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
