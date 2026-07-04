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
      !window.confirm(
        "Disable this schedule? It will stop automatic local delivery runs until re-enabled."
      )
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
          throw new Error(result.message ?? "Schedule update failed.");
        }

        setMessage(nextEnabled ? "Schedule enabled." : "Schedule disabled.");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Schedule update failed."
        );
      }
    });
  }

  function runNow() {
    if (
      !window.confirm(
        "Run this schedule now? Manual runs can send the selected published digest to enabled channels and will create delivery logs."
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
          throw new Error(result.message ?? "Schedule run failed.");
        }

        setMessage(`Run ${result.run.status}: ${result.run.message}`);
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Schedule run failed."
        );
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
        {enabled ? "Disable schedule" : "Enable schedule"}
      </button>
      <button
        type="button"
        className="action-button action-button--accent"
        onClick={runNow}
        disabled={isPending || !enabled}
        title={
          enabled
            ? "Run this schedule immediately"
            : "Enable this schedule first"
        }
      >
        Run schedule now
      </button>
      {!enabled ? (
        <p className="candidate-review-actions__hint">
          Manual schedule run is disabled because this schedule is off.
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
        "Run all due schedules now? Only enabled schedules and enabled channels will be attempted."
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
          throw new Error(result.message ?? "Due schedule run failed.");
        }

        setMessage(`${result.runs.length} due schedule run(s) completed.`);
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Due schedule run failed."
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
            ? "Create and enable at least one schedule before running due schedules"
            : "Run every enabled schedule that is due now"
        }
      >
        Run due schedules now
      </button>
      {disabled ? (
        <p className="candidate-review-actions__hint">
          No enabled schedules are ready to run.
        </p>
      ) : null}
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </div>
  );
}
