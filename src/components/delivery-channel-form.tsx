"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import type { DeliveryChannel, DeliveryChannelType } from "@/types/content";

interface DeliveryChannelFormProps {
  channel?: DeliveryChannel;
}

function getFormValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

// Feishu, Telegram and Discord each send one fixed message shape, so their
// format is always text and the select is not offered.
const fixedTextFormatTypes: DeliveryChannelType[] = [
  "feishu_webhook",
  "telegram",
  "discord"
];

const endpointCopy: Record<
  string,
  { label: string; placeholder: string; required: boolean }
> = {
  webhook: {
    label: "端点 URL",
    placeholder: "https://example.com/webhook 或 mock://success",
    required: true
  },
  feishu_webhook: {
    label: "飞书机器人 Webhook URL",
    placeholder: "https://open.feishu.cn/open-apis/bot/v2/hook/…",
    required: true
  },
  telegram: {
    label: "Bot API 地址（留空使用 https://api.telegram.org）",
    placeholder: "留空，或本地测试服务器地址",
    required: false
  },
  discord: {
    label: "Discord Webhook URL",
    placeholder: "https://discord.com/api/webhooks/<id>/<token>",
    required: true
  }
};

export function DeliveryChannelForm({ channel }: DeliveryChannelFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const isEditing = Boolean(channel);
  const defaultType = channel?.type ?? "webhook";
  const defaultFormat =
    channel?.format ??
    (fixedTextFormatTypes.includes(defaultType) ? "text" : "json");
  const formatRef = useRef<HTMLSelectElement>(null);
  // Only decides which fields are shown; the select itself stays
  // uncontrolled (see the note on it below).
  const [selectedType, setSelectedType] =
    useState<DeliveryChannelType>(defaultType);
  const endpoint = endpointCopy[selectedType] ?? endpointCopy.webhook;
  const isTelegram = selectedType === "telegram";
  const hasFixedFormat = fixedTextFormatTypes.includes(selectedType);

  function submit(formData: FormData) {
    startTransition(async () => {
      setMessage("");

      const payload = {
        name: getFormValue(formData, "name"),
        type: getFormValue(formData, "type"),
        endpointUrl: getFormValue(formData, "endpointUrl"),
        enabled: formData.get("enabled") === "on",
        format: hasFixedFormat ? "text" : getFormValue(formData, "format"),
        description: getFormValue(formData, "description"),
        // Blank on an update keeps the stored token.
        botToken: isTelegram ? getFormValue(formData, "botToken") : "",
        chatId: isTelegram ? getFormValue(formData, "chatId") : ""
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
              const nextType = event.target.value as DeliveryChannelType;

              setSelectedType(nextType);

              if (fixedTextFormatTypes.includes(nextType) && formatRef.current) {
                formatRef.current.value = "text";
              }
            }}
          >
            <option value="webhook">通用 Webhook</option>
            <option value="feishu_webhook">飞书机器人 Webhook</option>
            <option value="telegram">Telegram 机器人</option>
            <option value="discord">Discord Webhook</option>
          </select>
        </label>

        <label className="field">
          <span>格式</span>
          <select
            key={defaultFormat}
            ref={formatRef}
            name="format"
            defaultValue={defaultFormat}
            disabled={hasFixedFormat}
          >
            <option value="json">JSON Webhook 载荷</option>
            <option value="text">文本简报摘要</option>
          </select>
        </label>

        <label className="field source-form__wide">
          <span>{endpoint.label}</span>
          <input
            name="endpointUrl"
            defaultValue={channel?.endpointUrl ?? ""}
            placeholder={endpoint.placeholder}
            required={endpoint.required}
          />
        </label>

        {isTelegram ? (
          <>
            <label className="field">
              <span>Bot token</span>
              <input
                name="botToken"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={
                  channel?.botTokenMasked
                    ? `已保存 ${channel.botTokenMasked}，留空沿用`
                    : "123456789:AA…（@BotFather 给的 token）"
                }
                required={!channel?.botTokenMasked}
              />
            </label>
            <label className="field">
              <span>Chat id</span>
              <input
                name="chatId"
                defaultValue={channel?.chatId ?? ""}
                placeholder="-1001234567890 或 @频道用户名"
                required
              />
            </label>
          </>
        ) : null}

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
        通用 Webhook 支持 JSON 或文本载荷。飞书、Telegram 与 Discord
        发送固定格式的消息：简报标题、日期、摘要、前 3 条立即关注与值得跟踪，以及公开链接。
        Telegram 的 token 保存后只显示前半段；Webhook 地址里的密钥在列表里会被掩码。
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
