"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { DeliveryChannel, ScheduledDelivery } from "@/types/content";

interface ScheduledDeliveryFormProps {
  schedule?: ScheduledDelivery;
  channels: DeliveryChannel[];
}

function getFormValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export function ScheduledDeliveryForm({
  schedule,
  channels
}: ScheduledDeliveryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [digestTarget, setDigestTarget] = useState(
    schedule?.digestTarget ?? "latest_published_digest"
  );
  const isEditing = Boolean(schedule);
  const selectedChannelIds = new Set(schedule?.channelIds ?? []);

  function submit(formData: FormData) {
    startTransition(async () => {
      setMessage("");

      const payload = {
        name: getFormValue(formData, "name"),
        enabled: formData.get("enabled") === "on",
        digestTarget: getFormValue(formData, "digestTarget"),
        digestDate: getFormValue(formData, "digestDate"),
        channelIds: formData.getAll("channelIds").map((value) => String(value)),
        scheduleTime: getFormValue(formData, "scheduleTime"),
        timezone: getFormValue(formData, "timezone")
      };

      try {
        const response = await fetch(
          isEditing
            ? `/api/workspace/delivery/schedules/${schedule?.id}`
            : "/api/workspace/delivery/schedules",
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
          schedule?: ScheduledDelivery;
          message?: string;
          issues?: string[];
        };

        if (!response.ok || !result.ok || !result.schedule) {
          throw new Error(
            result.issues?.join(" ") ?? result.message ?? "计划保存失败。"
          );
        }

        setMessage(isEditing ? "计划已更新。" : "计划已创建。");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "计划保存失败。");
      }
    });
  }

  return (
    <form action={submit} className="source-form delivery-channel-form">
      <div className="source-form__grid">
        <label className="field">
          <span>名称</span>
          <input name="name" defaultValue={schedule?.name ?? ""} required />
        </label>

        <label className="field">
          <span>简报目标</span>
          <select
            name="digestTarget"
            value={digestTarget}
            onChange={(event) =>
              setDigestTarget(
                event.target.value as ScheduledDelivery["digestTarget"]
              )
            }
          >
            <option value="latest_published_digest">最新已发布简报</option>
            <option value="digest_by_date">指定日期简报</option>
          </select>
        </label>

        <label className="field">
          <span>简报日期</span>
          <input
            name="digestDate"
            type="date"
            defaultValue={schedule?.digestDate ?? ""}
            disabled={digestTarget !== "digest_by_date"}
            required={digestTarget === "digest_by_date"}
          />
        </label>

        <label className="field">
          <span>计划时间</span>
          <input
            name="scheduleTime"
            type="time"
            defaultValue={schedule?.scheduleTime ?? "09:00"}
            required
          />
        </label>

        <label className="field">
          <span>时区</span>
          <input
            name="timezone"
            defaultValue={schedule?.timezone ?? "Asia/Shanghai"}
            required
          />
        </label>
      </div>

      <fieldset className="source-form__wide digest-delivery-list">
        <legend>投递渠道</legend>
        {channels.length > 0 ? (
          channels.map((channel) => (
            <label className="source-form__checkbox" key={channel.id}>
              <input
                name="channelIds"
                type="checkbox"
                value={channel.id}
                defaultChecked={
                  schedule
                    ? selectedChannelIds.has(channel.id)
                    : channel.enabled
                }
              />
              <span>
                {channel.name}（{channel.type}，
                {channel.enabled ? "已启用" : "已停用"}）
              </span>
            </label>
          ))
        ) : (
          <p className="empty-state">请先创建投递渠道，再配置计划。</p>
        )}
      </fieldset>

      <label className="source-form__checkbox">
        <input
          name="enabled"
          type="checkbox"
          defaultChecked={schedule?.enabled ?? true}
        />
        <span>启用定时投递</span>
      </label>

      <p className="empty-state">
        定时投递只发送已发布的简报。运行时会跳过已停用的渠道。
      </p>

      <div className="candidate-review-actions__buttons">
        <button
          type="submit"
          className="action-button action-button--accent"
          disabled={isPending || channels.length === 0}
        >
          {isEditing ? "保存计划" : "创建计划"}
        </button>
      </div>

      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </form>
  );
}
