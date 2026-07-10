"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface DeliveryRunActionsProps {
  runId: string;
  status: "pending" | "success" | "failed";
}

export function DeliveryRunActions({ runId, status }: DeliveryRunActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function retry() {
    if (
      !window.confirm(
        "重试这次失败的投递？简报可能会再次发送到该渠道，并生成一条新的投递日志。"
      )
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(
          `/api/workspace/delivery/logs/${runId}/retry`,
          {
            method: "POST"
          }
        );
        const result = (await response.json()) as {
          ok: boolean;
          run?: unknown;
          message?: string;
        };

        if (!response.ok || !result.ok) {
          throw new Error(result.message ?? "投递重试失败。");
        }

        setMessage("重试完成，请查看最新的投递日志。");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "投递重试失败。");
      }
    });
  }

  if (status !== "failed") {
    return null;
  }

  return (
    <div className="delivery-run-actions">
      <button
        type="button"
        className="action-button action-button--subtle"
        onClick={retry}
        disabled={isPending}
      >
        重试投递
      </button>
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </div>
  );
}
