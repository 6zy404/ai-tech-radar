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
import type {
  SkillItem,
  SkillWorkspaceRecord,
  TopicTag
} from "@/types/content";

interface RelatedOption {
  id: string;
  title: string;
}

interface SkillWorkspaceFormProps {
  skill?: SkillItem;
  tagOptions: TopicTag[];
  technologyOptions: RelatedOption[];
  knowledgeOptions: RelatedOption[];
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

export function SkillWorkspaceForm({
  skill,
  tagOptions,
  technologyOptions,
  knowledgeOptions,
  relationDefaults = {}
}: SkillWorkspaceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const isEditing = Boolean(skill);

  function submit(formData: FormData) {
    startTransition(async () => {
      setMessage("");

      const payload = {
        title: getFormValue(formData, "title"),
        slug: getFormValue(formData, "slug"),
        summary: getFormValue(formData, "summary"),
        content: String(formData.get("content") ?? ""),
        skillType: getFormValue(formData, "skillType"),
        heatLevel: getFormValue(formData, "heatLevel"),
        learningCost: getFormValue(formData, "learningCost"),
        tags: getFormValues(formData, "tags"),
        relatedTechnologyIds: getFormValues(formData, "relatedTechnologyIds"),
        relatedKnowledgeIds: getFormValues(formData, "relatedKnowledgeIds")
      };

      try {
        const response = await fetch(
          isEditing
            ? `/api/workspace/skills/${skill?.id}`
            : "/api/workspace/skills",
          {
            method: isEditing ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }
        );
        const result = (await response.json()) as {
          ok: boolean;
          record?: SkillWorkspaceRecord;
          message?: string;
        };

        if (!response.ok || !result.ok || !result.record) {
          throw new Error(result.message ?? "技能保存失败。");
        }

        if (isEditing) {
          await syncRelationTargets(
            result.record.id,
            "skill",
            collectRelationTargets(formData, [
              { name: "relatedTechnologyIds", targetType: "technology" },
              { name: "relatedKnowledgeIds", targetType: "knowledge" }
            ])
          );
        }

        setMessage(isEditing ? "技能已保存。" : "技能草稿已创建。");

        if (!isEditing) {
          router.push(`/workspace/skills/${result.record.id}`);
        } else {
          router.refresh();
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "技能保存失败。");
      }
    });
  }

  return (
    <form action={submit} className="source-form">
      <div className="source-form__grid">
        <label className="field">
          <span>标题</span>
          <input name="title" defaultValue={skill?.title ?? ""} required />
        </label>

        <label className="field">
          <span>Slug（发布后用于 /skills/[slug]，须唯一）</span>
          <input name="slug" defaultValue={skill?.slug ?? ""} required />
        </label>

        <label className="field source-form__wide">
          <span>摘要</span>
          <textarea
            name="summary"
            defaultValue={skill?.summary ?? ""}
            rows={2}
            required
          />
        </label>

        <label className="field source-form__wide">
          <span>正文</span>
          <textarea
            name="content"
            defaultValue={skill?.content ?? ""}
            rows={8}
          />
        </label>

        <label className="field">
          <span>技能类型</span>
          <select
            name="skillType"
            defaultValue={skill?.skillType ?? "engineering"}
          >
            <option value="engineering">工程落地</option>
            <option value="analysis">评估与分析</option>
            <option value="product">产品决策</option>
            <option value="operations">运维</option>
            <option value="communication">沟通协作</option>
          </select>
        </label>

        <label className="field">
          <span>热度</span>
          <select name="heatLevel" defaultValue={skill?.heatLevel ?? "active"}>
            <option value="emerging">新兴</option>
            <option value="active">活跃</option>
            <option value="hot">当前热门</option>
          </select>
        </label>

        <label className="field">
          <span>学习成本</span>
          <select
            name="learningCost"
            defaultValue={skill?.learningCost ?? "medium"}
          >
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
        </label>
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
                defaultChecked={skill?.tags.includes(tag.id) ?? false}
              />
              <span>{tag.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="content-workspace-fieldset">
        <legend>
          相关技术信号{isEditing ? "（勾选后可设置关系类型与备注）" : ""}
        </legend>
        <div className="content-workspace-checkbox-grid">
          {technologyOptions.map((option) =>
            isEditing ? (
              <RelationCheckboxItem
                key={option.id}
                name="relatedTechnologyIds"
                option={option}
                defaultChecked={
                  skill?.relatedTechnologyIds.includes(option.id) ?? false
                }
                checkboxClassName="content-workspace-checkbox"
                targetType="technology"
                relationDefault={
                  relationDefaults[
                    getRelationDefaultKey("technology", option.id)
                  ]
                }
              />
            ) : (
              <label key={option.id} className="content-workspace-checkbox">
                <input
                  type="checkbox"
                  name="relatedTechnologyIds"
                  value={option.id}
                  defaultChecked={false}
                />
                <span>{option.title}</span>
              </label>
            )
          )}
        </div>
      </fieldset>

      <fieldset className="content-workspace-fieldset">
        <legend>
          相关知识{isEditing ? "（勾选后可设置关系类型与备注）" : ""}
        </legend>
        <div className="content-workspace-checkbox-grid">
          {knowledgeOptions.map((option) =>
            isEditing ? (
              <RelationCheckboxItem
                key={option.id}
                name="relatedKnowledgeIds"
                option={option}
                defaultChecked={
                  skill?.relatedKnowledgeIds.includes(option.id) ?? false
                }
                checkboxClassName="content-workspace-checkbox"
                targetType="knowledge"
                relationDefault={
                  relationDefaults[
                    getRelationDefaultKey("knowledge", option.id)
                  ]
                }
              />
            ) : (
              <label key={option.id} className="content-workspace-checkbox">
                <input
                  type="checkbox"
                  name="relatedKnowledgeIds"
                  value={option.id}
                  defaultChecked={false}
                />
                <span>{option.title}</span>
              </label>
            )
          )}
        </div>
      </fieldset>

      <div className="candidate-review-actions__buttons">
        <button
          type="submit"
          className="action-button action-button--accent"
          disabled={isPending}
        >
          {isEditing ? "保存技能" : "创建技能草稿"}
        </button>
      </div>

      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </form>
  );
}
