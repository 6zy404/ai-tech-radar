"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ScheduledDeliveryRun } from "@/types/content";

interface ScheduledDeliveryActionsProps {
  scheduleId: string;
  enabled: boolean;
}

interface RunDueSchedulesButtonProps {
  disabled?: boolean;
}

export function ScheduledDeliveryActions({
  scheduleId,
  enabled
}: ScheduledDeliveryActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateEnabled(nextEnabled: boolean) {
    if (
      !nextEnabled &&
      !window.confirm("停用这个计划？重新启用前它将停止本地自动投递运行。")
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(
          `/api/workspace/delivery/schedules/${scheduleId}/enabled`,
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
          throw new Error(result.message ?? "计划更新失败。");
        }

        setMessage(nextEnabled ? "计划已启用。" : "计划已停用。");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "计划更新失败。");
      }
    });
  }

  function runNow() {
    if (
      !window.confirm(
        "立即运行这个计划？手动运行会把所选已发布简报发送到已启用渠道，并生成投递日志。"
      )
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(
          `/api/workspace/delivery/schedules/${scheduleId}/run`,
          {
            method: "POST"
          }
        );
        const result = (await response.json()) as {
          ok: boolean;
          run?: ScheduledDeliveryRun;
          message?: string;
        };

        if (!response.ok || !result.ok || !result.run) {
          throw new Error(result.message ?? "计划运行失败。");
        }

        setMessage(`运行 ${result.run.status}：${result.run.message}`);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "计划运行失败。");
      }
    });
  }

  return (
    <div className="delivery-run-actions">
      <button
        type="button"
        className="action-button"
        onClick={() => updateEnabled(!enabled)}
        disabled={isPending}
      >
        {enabled ? "停用计划" : "启用计划"}
      </button>
      <button
        type="button"
        className="action-button action-button--accent"
        onClick={runNow}
        disabled={isPending || !enabled}
        title={enabled ? "立即运行这个计划" : "请先启用这个计划"}
      >
        立即运行计划
      </button>
      {!enabled ? (
        <p className="candidate-review-actions__hint">
          计划已停用，无法手动运行。
        </p>
      ) : null}
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </div>
  );
}

export function RunDueSchedulesButton({
  disabled
}: RunDueSchedulesButtonProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function runDueSchedules() {
    if (
      !window.confirm(
        "立即运行所有到期计划？只会尝试已启用的计划和已启用的渠道。"
      )
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(
          "/api/workspace/delivery/schedules/run-due",
          {
            method: "POST"
          }
        );
        const result = (await response.json()) as {
          ok: boolean;
          runs?: ScheduledDeliveryRun[];
          message?: string;
        };

        if (!response.ok || !result.ok || !result.runs) {
          throw new Error(result.message ?? "到期计划运行失败。");
        }

        setMessage(`已完成 ${result.runs.length} 次到期计划运行。`);
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "到期计划运行失败。"
        );
      }
    });
  }

  return (
    <div className="delivery-run-actions">
      <button
        type="button"
        className="action-button action-button--accent"
        onClick={runDueSchedules}
        disabled={isPending || disabled}
        title={
          disabled
            ? "先创建并启用至少一个计划，再运行到期计划"
            : "运行当前所有到期的已启用计划"
        }
      >
        立即运行到期计划
      </button>
      {disabled ? (
        <p className="candidate-review-actions__hint">
          没有可运行的已启用计划。
        </p>
      ) : null}
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </div>
  );
}
