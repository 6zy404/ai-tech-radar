"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

// Enable/disable + daily-time controls for a once-a-day task-runner job.
// ScheduledImportActions and ScheduledDigestActions are this component with
// their own endpoint and wording; the two used to be copies of each other.

export interface DailyScheduleActionsCopy {
  // The job's name as the buttons say it, e.g. 定时导入.
  name: string;
  // What the time is for, e.g. 导入 in 每日导入时间.
  verb: string;
  disableConfirm: string;
}

interface DailyScheduleActionsProps {
  endpoint: string;
  enabled: boolean;
  scheduleTime: string;
  copy: DailyScheduleActionsCopy;
}

export function DailyScheduleActions({
  endpoint,
  enabled,
  scheduleTime,
  copy
}: DailyScheduleActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [timeValue, setTimeValue] = useState(scheduleTime);
  const [isPending, startTransition] = useTransition();
  const failureMessage = `${copy.name}配置更新失败。`;

  function patchConfig(
    body: { enabled?: boolean; scheduleTime?: string },
    successMessage: string
  ) {
    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(endpoint, {
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
          throw new Error(result.message ?? failureMessage);
        }

        setMessage(successMessage);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : failureMessage);
      }
    });
  }

  function updateEnabled(nextEnabled: boolean) {
    if (!nextEnabled && !window.confirm(copy.disableConfirm)) {
      return;
    }

    patchConfig(
      { enabled: nextEnabled },
      nextEnabled ? `${copy.name}已启用。` : `${copy.name}已停用。`
    );
  }

  function saveScheduleTime() {
    patchConfig(
      { scheduleTime: timeValue },
      `${copy.verb}时间已更新为 ${timeValue}。`
    );
  }

  return (
    <div className="delivery-run-actions">
      <button
        type="button"
        className="action-button"
        onClick={() => updateEnabled(!enabled)}
        disabled={isPending}
      >
        {enabled ? `停用${copy.name}` : `启用${copy.name}`}
      </button>
      <label className="scheduled-import-time">
        <span>每日{copy.verb}时间</span>
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
          timeValue === scheduleTime
            ? "先修改时间再保存"
            : `保存每日${copy.verb}时间`
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
