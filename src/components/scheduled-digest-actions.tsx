"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface ScheduledDigestActionsProps {
  enabled: boolean;
  scheduleTime: string;
}

export function ScheduledDigestActions({
  enabled,
  scheduleTime
}: ScheduledDigestActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [timeValue, setTimeValue] = useState(scheduleTime);
  const [isPending, startTransition] = useTransition();

  function patchConfig(
    body: { enabled?: boolean; scheduleTime?: string },
    successMessage: string
  ) {
    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch("/api/workspace/scheduled-digest", {
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
          throw new Error(result.message ?? "定时简报草稿配置更新失败。");
        }

        setMessage(successMessage);
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "定时简报草稿配置更新失败。"
        );
      }
    });
  }

  function updateEnabled(nextEnabled: boolean) {
    if (
      !nextEnabled &&
      !window.confirm(
        "停用定时简报草稿？任务运行器将不再自动生成每日简报草稿，编辑轮需要手动生成。"
      )
    ) {
      return;
    }

    patchConfig(
      { enabled: nextEnabled },
      nextEnabled ? "定时简报草稿已启用。" : "定时简报草稿已停用。"
    );
  }

  function saveScheduleTime() {
    patchConfig({ scheduleTime: timeValue }, `生成时间已更新为 ${timeValue}。`);
  }

  return (
    <div className="delivery-run-actions">
      <button
        type="button"
        className="action-button"
        onClick={() => updateEnabled(!enabled)}
        disabled={isPending}
      >
        {enabled ? "停用定时简报草稿" : "启用定时简报草稿"}
      </button>
      <label className="scheduled-import-time">
        <span>每日生成时间</span>
        <input
          type="time"
          value={timeValue}
          onChange={(event) => setTimeValue(event.target.value)}
          disabled={isPending}
        />
      </label>
      <button
        type="button"
        className="action-button action-button--accent"
        onClick={saveScheduleTime}
        disabled={isPending || timeValue === scheduleTime}
        title={
          timeValue === scheduleTime ? "先修改时间再保存" : "保存每日生成时间"
        }
      >
        保存时间
      </button>
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </div>
  );
}
