"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface DeliveryChannelActionsProps {
  channelId: string;
  enabled: boolean;
}

export function DeliveryChannelActions({
  channelId,
  enabled
}: DeliveryChannelActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function updateEnabled(nextEnabled: boolean) {
    if (
      !nextEnabled &&
      !window.confirm(
        "停用这个投递渠道？停用后它将无法接收手动或定时的简报发送。"
      )
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(
          `/api/workspace/delivery/channels/${channelId}/enabled`,
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
          throw new Error(result.message ?? "投递渠道更新失败。");
        }

        setMessage(nextEnabled ? "渠道已启用。" : "渠道已停用。");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "投递渠道更新失败。"
        );
      }
    });
  }

  return (
    <div className="source-actions source-actions--compact">
      <div className="candidate-review-actions__buttons">
        <button
          type="button"
          className="action-button action-button--subtle"
          onClick={() => updateEnabled(!enabled)}
          disabled={isPending}
        >
          {enabled ? "停用渠道" : "启用渠道"}
        </button>
      </div>
      {!enabled ? (
        <p className="candidate-review-actions__hint">
          已停用的渠道无法参与手动和定时投递。
        </p>
      ) : null}
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </div>
  );
}
