"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { getDeliveryChannelTypeLabel } from "@/lib/delivery-labels";
import type {
  DailyDigestStatus,
  DeliveryChannel,
  DeliveryRun
} from "@/types/content";

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
  const [selectedChannelId, setSelectedChannelId] = useState(
    channels[0]?.id ?? ""
  );
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
          throw new Error(result.message ?? "投递预览失败。");
        }

        if (!isCancelled) {
          setPreview(result.preview.requestPayloadPreview);
        }
      } catch (error) {
        if (!isCancelled) {
          setPreview("");
          setMessage(error instanceof Error ? error.message : "投递预览失败。");
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
        `把这期已发布简报发送到「${
          selectedChannel?.name ?? "所选投递渠道"
        }」？这是一次对外投递操作，并会写入投递日志。`
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
          throw new Error(result.message ?? "简报投递失败。");
        }

        setMessage(
          result.run.status === "success"
            ? "投递成功。"
            : (result.run.errorMessage ?? "投递失败，请查看投递日志。")
        );
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "简报投递失败。");
      }
    });
  }

  return (
    <section className="detail-panel digest-delivery-action-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">简报投递</p>
          <h2>手动发送</h2>
          <p>把这期已发布简报发送到一个已启用的工作台投递渠道。</p>
        </div>
      </div>

      {!canDeliver ? (
        <p className="empty-state">先发布这期简报，再发送到投递渠道。</p>
      ) : channels.length === 0 ? (
        <p className="empty-state">
          没有可用的已启用投递渠道。{" "}
          <Link href="/workspace/delivery">配置投递渠道</Link>。
        </p>
      ) : (
        <>
          <label className="field">
            <span>投递渠道</span>
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
            <h3>投递预览</h3>
            <textarea
              className="digest-share-preview"
              readOnly
              value={
                isLoadingPreview
                  ? "正在加载投递预览…"
                  : preview || "预览不可用。"
              }
              aria-label="简报投递载荷预览"
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
                  ? "把已发布简报发送到所选的已启用渠道"
                  : "请先选择一个已启用的投递渠道"
              }
            >
              发送到所选渠道
            </button>
          </div>
        </>
      )}

      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </section>
  );
}
