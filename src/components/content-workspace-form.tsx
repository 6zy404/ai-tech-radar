"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  collectRelationTargets,
  getRelationDefaultKey,
  RelationCheckboxItem,
  syncRelationTargets,
  type RelationDefaultsMap
} from "@/components/relation-checkbox-item";
import type { ContentKind, TopicTag } from "@/types/content";

interface RelatedOption {
  id: string;
  title: string;
}

/** The serializable half of a workspace content kind — what the form needs. */
export interface ContentWorkspaceFormKind {
  entityType: "skill" | "knowledge";
  /** 技能 / 知识 */
  noun: string;
  /** 技能 / 知识条目 — where the knowledge copy says 条目 */
  entryNoun: string;
  apiBasePath: string;
  workspacePath: string;
  publicPath: string;
  attributes: {
    key: string;
    label: string;
    fallback: string;
    options: { value: string; label: string }[];
  }[];
}

export interface ContentWorkspaceRelatedGroup {
  /** Form field and item key, e.g. `relatedKnowledgeIds`. */
  name: string;
  legend: string;
  targetType: ContentKind;
  options: RelatedOption[];
}

type FormItem = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  tags: string[];
};

interface ContentWorkspaceFormProps {
  kind: ContentWorkspaceFormKind;
  item?: FormItem;
  tagOptions: TopicTag[];
  relatedGroups: ContentWorkspaceRelatedGroup[];
  relationDefaults?: RelationDefaultsMap;
}

function getFormValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function getFormValues(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .map((value) => String(value))
    .filter(Boolean);
}

function readField(item: FormItem | undefined, key: string): unknown {
  return item ? (item as unknown as Record<string, unknown>)[key] : undefined;
}

export function ContentWorkspaceForm({
  kind,
  item,
  tagOptions,
  relatedGroups,
  relationDefaults = {}
}: ContentWorkspaceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const isEditing = Boolean(item);
  const saveFailed = `${kind.entryNoun}保存失败。`;

  function submit(formData: FormData) {
    startTransition(async () => {
      setMessage("");

      const payload: Record<string, unknown> = {
        title: getFormValue(formData, "title"),
        slug: getFormValue(formData, "slug"),
        summary: getFormValue(formData, "summary"),
        content: String(formData.get("content") ?? "")
      };

      for (const attribute of kind.attributes) {
        payload[attribute.key] = getFormValue(formData, attribute.key);
      }

      payload.tags = getFormValues(formData, "tags");

      for (const group of relatedGroups) {
        payload[group.name] = getFormValues(formData, group.name);
      }

      try {
        const response = await fetch(
          isEditing ? `${kind.apiBasePath}/${item?.id}` : kind.apiBasePath,
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
          throw new Error(result.message ?? saveFailed);
        }

        if (isEditing) {
          await syncRelationTargets(
            result.record.id,
            kind.entityType,
            collectRelationTargets(formData, relatedGroups)
          );
        }

        setMessage(
          isEditing ? `${kind.entryNoun}已保存。` : `${kind.noun}草稿已创建。`
        );

        if (!isEditing) {
          router.push(`${kind.workspacePath}/${result.record.id}`);
        } else {
          router.refresh();
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : saveFailed);
      }
    });
  }

  return (
    <form action={submit} className="source-form">
      <div className="source-form__grid">
        <label className="field">
          <span>标题</span>
          <input name="title" defaultValue={item?.title ?? ""} required />
        </label>

        <label className="field">
          <span>{`Slug（发布后用于 ${kind.publicPath}/[slug]，须唯一）`}</span>
          <input name="slug" defaultValue={item?.slug ?? ""} required />
        </label>

        <label className="field source-form__wide">
          <span>摘要</span>
          <textarea
            name="summary"
            defaultValue={item?.summary ?? ""}
            rows={2}
            required
          />
        </label>

        <label className="field source-form__wide">
          <span>正文</span>
          <textarea
            name="content"
            defaultValue={item?.content ?? ""}
            rows={8}
          />
        </label>

        {kind.attributes.map((attribute) => (
          <label key={attribute.key} className="field">
            <span>{attribute.label}</span>
            <select
              name={attribute.key}
              defaultValue={
                (readField(item, attribute.key) as string | undefined) ??
                attribute.fallback
              }
            >
              {attribute.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <fieldset className="content-workspace-fieldset">
        <legend>话题标签（仅可选规范标签）</legend>
        <div className="content-workspace-checkbox-grid">
          {tagOptions.map((tag) => (
            <label key={tag.id} className="content-workspace-checkbox">
              <input
                type="checkbox"
                name="tags"
                value={tag.id}
                defaultChecked={item?.tags.includes(tag.id) ?? false}
              />
              <span>{tag.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {relatedGroups.map((group) => {
        const checkedIds =
          (readField(item, group.name) as string[] | undefined) ?? [];

        return (
          <fieldset key={group.name} className="content-workspace-fieldset">
            <legend>
              {group.legend}
              {isEditing ? "（勾选后可设置关系类型与备注）" : ""}
            </legend>
            <div className="content-workspace-checkbox-grid">
              {group.options.map((option) =>
                isEditing ? (
                  <RelationCheckboxItem
                    key={option.id}
                    name={group.name}
                    option={option}
                    defaultChecked={checkedIds.includes(option.id)}
                    checkboxClassName="content-workspace-checkbox"
                    targetType={group.targetType}
                    relationDefault={
                      relationDefaults[
                        getRelationDefaultKey(group.targetType, option.id)
                      ]
                    }
                  />
                ) : (
                  <label key={option.id} className="content-workspace-checkbox">
                    <input
                      type="checkbox"
                      name={group.name}
                      value={option.id}
                      defaultChecked={false}
                    />
                    <span>{option.title}</span>
                  </label>
                )
              )}
            </div>
          </fieldset>
        );
      })}

      <div className="candidate-review-actions__buttons">
        <button
          type="submit"
          className="action-button action-button--accent"
          disabled={isPending}
        >
          {isEditing ? `保存${kind.entryNoun}` : `创建${kind.noun}草稿`}
        </button>
      </div>

      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </form>
  );
}
