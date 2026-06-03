"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
  const [channelType, setChannelType] = useState(defaultType);
  const [format, setFormat] = useState(defaultFormat);

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
            result.issues?.join(" ") ??
              result.message ??
              "Delivery channel save failed."
          );
        }

        setMessage(isEditing ? "Delivery channel updated." : "Delivery channel created.");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Delivery channel save failed."
        );
      }
    });
  }

  return (
    <form action={submit} className="source-form delivery-channel-form">
      <div className="source-form__grid">
        <label className="field">
          <span>Name</span>
          <input name="name" defaultValue={channel?.name ?? ""} required />
        </label>

        <label className="field">
          <span>Channel type</span>
          <select
            name="type"
            value={channelType}
            onChange={(event) => {
              const nextType = event.target.value as DeliveryChannel["type"];
              setChannelType(nextType);
              if (nextType === "feishu_webhook") {
                setFormat("text");
              }
            }}
          >
            <option value="webhook">Generic webhook</option>
            <option value="feishu_webhook">Feishu bot webhook</option>
          </select>
        </label>

        <label className="field">
          <span>Format</span>
          <select
            name="format"
            value={format}
            onChange={(event) =>
              setFormat(event.target.value as DeliveryChannel["format"])
            }
          >
            <option value="json">JSON webhook payload</option>
            <option value="text">Text digest summary</option>
          </select>
        </label>

        <label className="field source-form__wide">
          <span>Endpoint URL</span>
          <input
            name="endpointUrl"
            defaultValue={channel?.endpointUrl ?? ""}
            placeholder="https://example.com/webhook, Feishu bot URL, or mock://success"
            required
          />
        </label>

        <label className="field source-form__wide">
          <span>Description</span>
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
        <span>Enabled for manual digest delivery</span>
      </label>

      <p className="empty-state">
        Generic webhook supports JSON or text payloads. Feishu bot webhook sends
        a Feishu text message, so choose text format for Feishu channels.
      </p>

      <div className="candidate-review-actions__buttons">
        <button
          type="submit"
          className="action-button action-button--accent"
          disabled={isPending}
        >
          {isEditing ? "Save channel" : "Create channel"}
        </button>
      </div>

      {message ? <p className="candidate-review-actions__message">{message}</p> : null}
    </form>
  );
}
