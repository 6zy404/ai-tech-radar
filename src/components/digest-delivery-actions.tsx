"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { getDeliveryChannelTypeLabel } from "@/lib/delivery-labels";
import type { DailyDigestStatus, DeliveryChannel, DeliveryRun } from "@/types/content";

interface DigestDeliveryActionsProps {
  digestDate: string;
  digestStatus: DailyDigestStatus;
  channels: DeliveryChannel[];
}

interface DeliveryPreviewResponse {
  ok: boolean;
  preview?: {
    contentType: string;
    requestPayloadPreview: string;
  };
  message?: string;
}

interface DeliverySendResponse {
  ok: boolean;
  run?: DeliveryRun;
  message?: string;
}

export function DigestDeliveryActions({
  digestDate,
  digestStatus,
  channels
}: DigestDeliveryActionsProps) {
  const router = useRouter();
  const [selectedChannelId, setSelectedChannelId] = useState(channels[0]?.id ?? "");
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canDeliver = digestStatus === "published";

  useEffect(() => {
    if (!canDeliver || !selectedChannelId) {
      setPreview("");
      return;
    }

    let isCancelled = false;

    async function loadPreview() {
      setIsLoadingPreview(true);
      setMessage("");

      try {
        const response = await fetch("/api/workspace/delivery/preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            digestDate,
            channelId: selectedChannelId
          })
        });
        const result = (await response.json()) as DeliveryPreviewResponse;

        if (!response.ok || !result.ok || !result.preview) {
          throw new Error(result.message ?? "Delivery preview failed.");
        }

        if (!isCancelled) {
          setPreview(result.preview.requestPayloadPreview);
        }
      } catch (error) {
        if (!isCancelled) {
          setPreview("");
          setMessage(
            error instanceof Error ? error.message : "Delivery preview failed."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPreview(false);
        }
      }
    }

    void loadPreview();

    return () => {
      isCancelled = true;
    };
  }, [canDeliver, digestDate, selectedChannelId]);

  function sendDigest() {
    const selectedChannel = channels.find(
      (channel) => channel.id === selectedChannelId
    );

    if (
      !window.confirm(
        `Send this published digest to ${
          selectedChannel?.name ?? "the selected delivery channel"
        }? This performs an external delivery action and writes a delivery log.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch("/api/workspace/delivery/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            digestDate,
            channelId: selectedChannelId
          })
        });
        const result = (await response.json()) as DeliverySendResponse;

        if (!response.ok || !result.ok || !result.run) {
          throw new Error(result.message ?? "Digest delivery failed.");
        }

        setMessage(
          result.run.status === "success"
            ? "Delivery succeeded."
            : result.run.errorMessage ?? "Delivery failed. Check delivery logs."
        );
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Digest delivery failed.");
      }
    });
  }

  return (
    <section className="detail-panel digest-delivery-action-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Digest Delivery</p>
          <h2>Manual send</h2>
          <p>
            Send this published digest to one enabled workspace delivery channel.
          </p>
        </div>
      </div>

      {!canDeliver ? (
        <p className="empty-state">
          Publish this digest before sending it to delivery channels.
        </p>
      ) : channels.length === 0 ? (
        <p className="empty-state">
          No enabled delivery channel is available.{" "}
          <Link href="/workspace/delivery">Configure delivery channels</Link>.
        </p>
      ) : (
        <>
          <label className="field">
            <span>Delivery channel</span>
            <select
              value={selectedChannelId}
              onChange={(event) => setSelectedChannelId(event.target.value)}
            >
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name} - {getDeliveryChannelTypeLabel(channel.type)} -{" "}
                  {channel.format.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <div className="digest-share-panel">
            <h3>Delivery preview</h3>
            <textarea
              className="digest-share-preview"
              readOnly
              value={
                isLoadingPreview
                  ? "Loading delivery preview..."
                  : preview || "Preview unavailable."
              }
              aria-label="Digest delivery payload preview"
            />
          </div>

          <div className="candidate-review-actions__buttons">
            <button
              type="button"
              className="action-button action-button--accent"
              onClick={sendDigest}
              disabled={isPending || isLoadingPreview || !selectedChannelId}
              title={
                selectedChannelId
                  ? "Send the published digest to the selected enabled channel"
                  : "Select an enabled delivery channel first"
              }
            >
              Send to selected channel
            </button>
          </div>
        </>
      )}

      {message ? <p className="candidate-review-actions__message">{message}</p> : null}
    </section>
  );
}
