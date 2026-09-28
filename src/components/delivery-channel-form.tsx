"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import type { DeliveryChannel } from "@/types/content";

interface DeliveryChannelFormProps {
  channel?: DeliveryChannel;
}

function getFormValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export function DeliveryChannelForm({ channel }: DeliveryChannelFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const isEditing = Boolean(channel);
  const defaultType = channel?.type ?? "webhook";
  const defaultFormat =
    channel?.format ?? (defaultType === "feishu_webhook" ? "text" : "json");
  const formatRef = useRef<HTMLSelectElement>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      setMessage("");

      const payload = {
        name: getFormValue(formData, "name"),
        type: getFormValue(formData, "type"),
        endpointUrl: getFormValue(formData, "endpointUrl"),
        enabled: formData.get("enabled") === "on",
        format: getFormValue(formData, "format"),
        description: getFormValue(formData, "description")
      };

      try {
        const response = await fetch(
          isEditing
            ? `/api/workspace/delivery/channels/${channel?.id}`
            : "/api/workspace/delivery/channels",
          {
            method: isEditing ? "PATCH" : "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          }
        );
        const result = (await response.json()) as {
          ok: boolean;
          channel?: DeliveryChannel;
          message?: string;
          issues?: string[];
        };

        if (!response.ok || !result.ok || !result.channel) {
          throw new Error(
            result.issues?.join(" ") ?? result.message ?? "投递渠道保存失败。"
          );
        }

        setMessage(isEditing ? "投递渠道已更新。" : "投递渠道已创建。");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "投递渠道保存失败。"
        );
      }
    });
  }

  return (
    <form action={submit} className="source-form delivery-channel-form">
      <div className="source-form__grid">
        <label className="field">
          <span>名称</span>
          <input name="name" defaultValue={channel?.name ?? ""} required />
        </label>

        {/* Both selects are uncontrolled and keyed by the saved value, as in
          ContentWorkspaceForm: React resets the form after a save, and a
          select returns to its defaultValue — a controlled one to its first
          option — so it would show, and the next save would send, a value
          that is not the saved one. */}
        <label className="field">
          <span>渠道类型</span>
          <select
            key={defaultType}
            name="type"
            defaultValue={defaultType}
            onChange={(event) => {
              if (
                event.target.value === "feishu_webhook" &&
                formatRef.current
              ) {
                formatRef.current.value = "text";
              }
            }}
          >
            <option value="webhook">通用 Webhook</option>
            <option value="feishu_webhook">飞书机器人 Webhook</option>
          </select>
        </label>

        <label className="field">
          <span>格式</span>
          <select
            key={defaultFormat}
            ref={formatRef}
            name="format"
            defaultValue={defaultFormat}
          >
            <option value="json">JSON Webhook 载荷</option>
            <option value="text">文本简报摘要</option>
          </select>
        </label>

        <label className="field source-form__wide">
          <span>端点 URL</span>
          <input
            name="endpointUrl"
            defaultValue={channel?.endpointUrl ?? ""}
            placeholder="https://example.com/webhook、飞书机器人 URL 或 mock://success"
            required
          />
        </label>

        <label className="field source-form__wide">
          <span>描述</span>
          <textarea
            name="description"
            defaultValue={channel?.description ?? ""}
            rows={3}
          />
        </label>
      </div>

      <label className="source-form__checkbox">
        <input
          name="enabled"
          type="checkbox"
          defaultChecked={channel?.enabled ?? true}
        />
        <span>允许手动简报投递</span>
      </label>

      <p className="empty-state">
        通用 Webhook 支持 JSON 或文本载荷。飞书机器人 Webhook
        发送的是飞书文本消息，因此飞书渠道请选择文本格式。
      </p>

      <div className="candidate-review-actions__buttons">
        <button
          type="submit"
          className="action-button action-button--accent"
          disabled={isPending}
        >
          {isEditing ? "保存渠道" : "创建渠道"}
        </button>
      </div>

      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </form>
  );
}
