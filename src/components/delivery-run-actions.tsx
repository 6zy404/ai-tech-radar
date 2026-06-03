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
        "Retry this failed delivery? This may send the digest to the channel again and will create a new delivery log."
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
          throw new Error(result.message ?? "Delivery retry failed.");
        }

        setMessage("Retry completed. Check the latest delivery log.");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Delivery retry failed."
        );
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
        Retry failed delivery
      </button>
      {message ? <p className="candidate-review-actions__message">{message}</p> : null}
    </div>
  );
}
