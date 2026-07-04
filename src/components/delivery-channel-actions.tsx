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
        "Disable this delivery channel? Disabled channels cannot receive manual or scheduled digest sends."
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
          throw new Error(result.message ?? "Delivery channel update failed.");
        }

        setMessage(nextEnabled ? "Channel enabled." : "Channel disabled.");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Delivery channel update failed."
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
          {enabled ? "Disable channel" : "Enable channel"}
        </button>
      </div>
      {!enabled ? (
        <p className="candidate-review-actions__hint">
          Disabled channels are blocked from manual and scheduled delivery.
        </p>
      ) : null}
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </div>
  );
}
