"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  getRadarQuadrantLabel,
  getRadarRingLabel,
  radarQuadrants,
  radarRings
} from "@/lib/radar-labels";
import type { RadarEntry } from "@/types/radar";

// Create / edit form of the radar console. History is not a field: the
// server appends a line whenever the ring changes, using the change reason
// below (or the ring reason when that is empty).

interface RadarFormOption {
  id: string;
  title: string;
  /** Shown after the title, e.g. a signal's publish date. */
  detail?: string;
}

export interface RadarFormGroup {
  name: "evidenceTechnologyIds" | "relatedKnowledgeIds" | "relatedSkillIds";
  legend: string;
  options: RadarFormOption[];
}

const apiBasePath = "/api/workspace/radar";
const workspacePath = "/workspace/radar";

function getValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function getValues(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .map((value) => String(value))
    .filter(Boolean);
}

export function RadarWorkspaceForm({
  entry,
  groups
}: {
  entry?: RadarEntry;
  groups: RadarFormGroup[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const isEditing = Boolean(entry);

  function submit(formData: FormData) {
    startTransition(async () => {
      setMessage("");

      const payload: Record<string, unknown> = {
        name: getValue(formData, "name"),
        slug: getValue(formData, "slug"),
        quadrant: getValue(formData, "quadrant"),
        ring: getValue(formData, "ring"),
        ringReason: getValue(formData, "ringReason"),
        changeReason: getValue(formData, "changeReason")
      };

      for (const group of groups) {
        payload[group.name] = getValues(formData, group.name);
      }

      try {
        const response = await fetch(
          isEditing ? `${apiBasePath}/${entry?.id}` : apiBasePath,
          {
            method: isEditing ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }
        );
        const result = (await response.json()) as {
          ok: boolean;
          record?: { id: string };
          message?: string;
        };

        if (!response.ok || !result.ok || !result.record) {
          throw new Error(result.message ?? "雷达条目保存失败。");
        }

        setMessage(isEditing ? "雷达条目已保存。" : "雷达条目草稿已创建。");

        if (isEditing) {
          router.refresh();
        } else {
          router.push(`${workspacePath}/${result.record.id}`);
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "雷达条目保存失败。"
        );
      }
    });
  }

  const quadrant = entry?.quadrant ?? "tools-methods";
  const ring = entry?.ring ?? "assess";

  return (
    <form action={submit} className="source-form">
      <div className="source-form__grid">
        <label className="field">
          <span>名称</span>
          <input name="name" defaultValue={entry?.name ?? ""} required />
        </label>

        <label className="field">
          <span>Slug（用于 /radar#radar-[slug]，须唯一）</span>
          <input name="slug" defaultValue={entry?.slug ?? ""} required />
        </label>

        <label className="field">
          <span>象限</span>
          {/* Keyed by the saved value: a select does not follow a changed
              defaultValue after a save, so without a remount it would show
              — and the next save would write back — the old value. */}
          <select key={quadrant} name="quadrant" defaultValue={quadrant}>
            {radarQuadrants.map((value) => (
              <option key={value} value={value}>
                {getRadarQuadrantLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>环位</span>
          <select key={ring} name="ring" defaultValue={ring}>
            {radarRings.map((value) => (
              <option key={value} value={value}>
                {getRadarRingLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="field source-form__wide">
          <span>环位理由（一句话，公开显示）</span>
          <textarea
            name="ringReason"
            defaultValue={entry?.ringReason ?? ""}
            rows={3}
            required
          />
        </label>

        <label className="field source-form__wide">
          <span>
            {isEditing
              ? "这次调整环位的理由（只在环位改变时写进环位历史；留空则用上面的环位理由）"
              : "收录理由（写进第一条环位历史；留空则用上面的环位理由）"}
          </span>
          <input
            key={entry?.history.length ?? 0}
            name="changeReason"
            defaultValue=""
          />
        </label>
      </div>

      {groups.map((group) => (
        <fieldset key={group.name} className="content-workspace-fieldset">
          <legend>{group.legend}</legend>
          <div className="content-workspace-checkbox-grid">
            {group.options.map((option) => (
              <label key={option.id} className="content-workspace-checkbox">
                <input
                  type="checkbox"
                  name={group.name}
                  value={option.id}
                  defaultChecked={
                    entry ? entry[group.name].includes(option.id) : false
                  }
                />
                <span>
                  {option.title}
                  {option.detail ? ` · ${option.detail}` : ""}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="candidate-review-actions__buttons">
        <button
          type="submit"
          className="action-button action-button--accent"
          disabled={isPending}
        >
          {isEditing ? "保存雷达条目" : "创建雷达条目草稿"}
        </button>
      </div>

      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </form>
  );
}
