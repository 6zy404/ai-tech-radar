"use client";

import {
  getRelationDefaultKey,
  type RelationDefault,
  type RelationDefaultsMap,
  type RelationDirection
} from "@/lib/relation-defaults";
import { getRelationTypeLabel } from "@/lib/technology-localization";
import type { ContentKind, RelationType } from "@/types/content";

export { getRelationDefaultKey };
export type { RelationDefault, RelationDefaultsMap };

const relationTypeOrder: RelationType[] = [
  "requires",
  "builds-on",
  "uses",
  "explains",
  "extends",
  "supersedes",
  "supports",
  "related-to"
];

interface RelationCheckboxItemProps {
  name: string;
  option: { id: string; title: string };
  defaultChecked: boolean;
  checkboxClassName: string;
  targetType: ContentKind;
  relationDefault?: RelationDefault;
}

const directionLabels: Record<RelationDirection, string> = {
  outgoing: "我需要先读它",
  incoming: "它需要先读我"
};

/**
 * One related-content checkbox with an attached relation-type select and
 * note input that unfold (via CSS `:has`) while the checkbox is checked.
 * A direction select joins them while the type is 必备 — the one type read
 * with its direction — prefilled with the stored direction, so a save from
 * the depended-on side no longer flips it. Stays uncontrolled: the relation
 * inputs are read from FormData with `collectRelationTargets` on submit.
 */
export function RelationCheckboxItem({
  name,
  option,
  defaultChecked,
  checkboxClassName,
  targetType,
  relationDefault
}: RelationCheckboxItemProps) {
  const relationType = relationDefault?.relationType ?? "related-to";
  const direction = relationDefault?.direction ?? "outgoing";

  return (
    <div className="relation-checkbox-item">
      <label className={checkboxClassName}>
        <input
          type="checkbox"
          name={name}
          value={option.id}
          defaultChecked={defaultChecked}
        />
        <span>{option.title}</span>
      </label>
      <div className="relation-checkbox-item__relation">
        {/* Keyed by the saved type so a save's form reset cannot leave the
            old one showing (see ContentWorkspaceForm). */}
        <select
          key={relationType}
          name={`relationType:${targetType}:${option.id}`}
          defaultValue={relationType}
          aria-label={`与「${option.title}」的关系类型`}
        >
          {relationTypeOrder.map((relationType) => (
            <option key={relationType} value={relationType}>
              {getRelationTypeLabel(relationType, "zh")}
            </option>
          ))}
        </select>
        <select
          key={direction}
          className="relation-checkbox-item__direction"
          name={`relationDirection:${targetType}:${option.id}`}
          defaultValue={direction}
          aria-label={`与「${option.title}」的必备方向`}
        >
          {(["outgoing", "incoming"] as const).map((value) => (
            <option key={value} value={value}>
              {directionLabels[value]}
            </option>
          ))}
        </select>
        <input
          type="text"
          name={`relationNote:${targetType}:${option.id}`}
          defaultValue={relationDefault?.note ?? ""}
          placeholder="关系备注（可选）"
          aria-label={`与「${option.title}」的关系备注`}
        />
      </div>
    </div>
  );
}

const relationTypeSet = new Set<string>(relationTypeOrder);

export interface RelationTargetPayload {
  toId: string;
  toType: ContentKind;
  relationType: RelationType;
  note?: string;
  direction?: RelationDirection;
}

/**
 * Reads the relation select/note inputs for every checked related id out of
 * the submitted FormData, in the shape `PUT /api/workspace/relations`
 * expects as `targets`.
 */
export function collectRelationTargets(
  formData: FormData,
  groups: { name: string; targetType: ContentKind }[]
): RelationTargetPayload[] {
  const targets: RelationTargetPayload[] = [];

  for (const group of groups) {
    const checkedIds = formData
      .getAll(group.name)
      .map((value) => String(value))
      .filter(Boolean);

    for (const toId of checkedIds) {
      const relationType = String(
        formData.get(`relationType:${group.targetType}:${toId}`) ?? ""
      );

      if (!relationTypeSet.has(relationType)) {
        continue;
      }

      const note = String(
        formData.get(`relationNote:${group.targetType}:${toId}`) ?? ""
      ).trim();
      const direction =
        relationType === "requires" &&
        formData.get(`relationDirection:${group.targetType}:${toId}`) ===
          "incoming"
          ? "incoming"
          : undefined;

      targets.push({
        toId,
        toType: group.targetType,
        relationType: relationType as RelationType,
        ...(note ? { note } : {}),
        ...(direction ? { direction } : {})
      });
    }
  }

  return targets;
}

/**
 * Sends the collected relation targets to the workspace relations API.
 * Returns the number of changed pairs; throws on a failed response.
 */
export async function syncRelationTargets(
  fromId: string,
  fromType: ContentKind,
  targets: RelationTargetPayload[]
): Promise<number> {
  const response = await fetch("/api/workspace/relations", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromId, fromType, targets })
  });
  const result = (await response.json()) as {
    ok: boolean;
    changedPairs?: number;
    message?: string;
  };

  if (!response.ok || !result.ok) {
    throw new Error(result.message ?? "关系保存失败。");
  }

  return result.changedPairs ?? 0;
}
