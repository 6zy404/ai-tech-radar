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
            result.issues?.join(" ") ??
              result.message ??
              "Scheduled delivery save failed."
          );
        }

        setMessage(isEditing ? "Schedule updated." : "Schedule created.");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Scheduled delivery save failed."
        );
      }
    });
  }

  return (
    <form action={submit} className="source-form delivery-channel-form">
      <div className="source-form__grid">
        <label className="field">
          <span>Name</span>
          <input name="name" defaultValue={schedule?.name ?? ""} required />
        </label>

        <label className="field">
          <span>Digest target</span>
          <select
            name="digestTarget"
            value={digestTarget}
            onChange={(event) =>
              setDigestTarget(
                event.target.value as ScheduledDelivery["digestTarget"]
              )
            }
          >
            <option value="latest_published_digest">Latest published digest</option>
            <option value="digest_by_date">Digest by date</option>
          </select>
        </label>

        <label className="field">
          <span>Digest date</span>
          <input
            name="digestDate"
            type="date"
            defaultValue={schedule?.digestDate ?? ""}
            disabled={digestTarget !== "digest_by_date"}
            required={digestTarget === "digest_by_date"}
          />
        </label>

        <label className="field">
          <span>Schedule time</span>
          <input
            name="scheduleTime"
            type="time"
            defaultValue={schedule?.scheduleTime ?? "09:00"}
            required
          />
        </label>

        <label className="field">
          <span>Timezone</span>
          <input
            name="timezone"
            defaultValue={schedule?.timezone ?? "Asia/Shanghai"}
            required
          />
        </label>
      </div>

      <fieldset className="source-form__wide digest-delivery-list">
        <legend>Delivery channels</legend>
        {channels.length > 0 ? (
          channels.map((channel) => (
            <label className="source-form__checkbox" key={channel.id}>
              <input
                name="channelIds"
                type="checkbox"
                value={channel.id}
                defaultChecked={
                  schedule ? selectedChannelIds.has(channel.id) : channel.enabled
                }
              />
              <span>
                {channel.name} ({channel.type}, {channel.enabled ? "enabled" : "disabled"})
              </span>
            </label>
          ))
        ) : (
          <p className="empty-state">Create a delivery channel before scheduling.</p>
        )}
      </fieldset>

      <label className="source-form__checkbox">
        <input
          name="enabled"
          type="checkbox"
          defaultChecked={schedule?.enabled ?? true}
        />
        <span>Enabled for scheduled delivery</span>
      </label>

      <p className="empty-state">
        Scheduled delivery only sends published digests. Disabled channels are
        skipped during a run.
      </p>

      <div className="candidate-review-actions__buttons">
        <button
          type="submit"
          className="action-button action-button--accent"
          disabled={isPending || channels.length === 0}
        >
          {isEditing ? "Save schedule" : "Create schedule"}
        </button>
      </div>

      {message ? <p className="candidate-review-actions__message">{message}</p> : null}
    </form>
  );
}
