"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  KnowledgeItem,
  KnowledgeWorkspaceRecord,
  TopicTag
} from "@/types/content";

interface RelatedOption {
  id: string;
  title: string;
}

interface KnowledgeWorkspaceFormProps {
  knowledge?: KnowledgeItem;
  tagOptions: TopicTag[];
  technologyOptions: RelatedOption[];
  skillOptions: RelatedOption[];
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

export function KnowledgeWorkspaceForm({
  knowledge,
  tagOptions,
  technologyOptions,
  skillOptions
}: KnowledgeWorkspaceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const isEditing = Boolean(knowledge);

  function submit(formData: FormData) {
    startTransition(async () => {
      setMessage("");

      const payload = {
        title: getFormValue(formData, "title"),
        slug: getFormValue(formData, "slug"),
        summary: getFormValue(formData, "summary"),
        content: String(formData.get("content") ?? ""),
        category: getFormValue(formData, "category"),
        difficulty: getFormValue(formData, "difficulty"),
        tags: getFormValues(formData, "tags"),
        relatedTechnologyIds: getFormValues(formData, "relatedTechnologyIds"),
        relatedSkillIds: getFormValues(formData, "relatedSkillIds")
      };

      try {
        const response = await fetch(
          isEditing
            ? `/api/workspace/knowledge/${knowledge?.id}`
            : "/api/workspace/knowledge",
          {
            method: isEditing ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }
        );
        const result = (await response.json()) as {
          ok: boolean;
          record?: KnowledgeWorkspaceRecord;
          message?: string;
        };

        if (!response.ok || !result.ok || !result.record) {
          throw new Error(result.message ?? "知识条目保存失败。");
        }

        setMessage(isEditing ? "知识条目已保存。" : "知识草稿已创建。");

        if (!isEditing) {
          router.push(`/workspace/knowledge/${result.record.id}`);
        } else {
          router.refresh();
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "知识条目保存失败。"
        );
      }
    });
  }

  return (
    <form action={submit} className="source-form">
      <div className="source-form__grid">
        <label className="field">
          <span>标题</span>
          <input name="title" defaultValue={knowledge?.title ?? ""} required />
        </label>

        <label className="field">
          <span>Slug（发布后用于 /knowledge/[slug]，须唯一）</span>
          <input name="slug" defaultValue={knowledge?.slug ?? ""} required />
        </label>

        <label className="field source-form__wide">
          <span>摘要</span>
          <textarea
            name="summary"
            defaultValue={knowledge?.summary ?? ""}
            rows={2}
            required
          />
        </label>

        <label className="field source-form__wide">
          <span>正文</span>
          <textarea
            name="content"
            defaultValue={knowledge?.content ?? ""}
            rows={8}
          />
        </label>

        <label className="field">
          <span>分类</span>
          <select
            name="category"
            defaultValue={knowledge?.category ?? "machine-learning"}
          >
            <option value="machine-learning">机器学习</option>
            <option value="software-architecture">软件架构</option>
            <option value="data">数据</option>
            <option value="product-thinking">产品思维</option>
            <option value="operations">运维</option>
          </select>
        </label>

        <label className="field">
          <span>难度</span>
          <select
            name="difficulty"
            defaultValue={knowledge?.difficulty ?? "foundation"}
          >
            <option value="foundation">基础</option>
            <option value="intermediate">进阶</option>
            <option value="advanced">高级</option>
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
                defaultChecked={knowledge?.tags.includes(tag.id) ?? false}
              />
              <span>{tag.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="content-workspace-fieldset">
        <legend>相关技术信号</legend>
        <div className="content-workspace-checkbox-grid">
          {technologyOptions.map((option) => (
            <label key={option.id} className="content-workspace-checkbox">
              <input
                type="checkbox"
                name="relatedTechnologyIds"
                value={option.id}
                defaultChecked={
                  knowledge?.relatedTechnologyIds.includes(option.id) ?? false
                }
              />
              <span>{option.title}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="content-workspace-fieldset">
        <legend>相关技能</legend>
        <div className="content-workspace-checkbox-grid">
          {skillOptions.map((option) => (
            <label key={option.id} className="content-workspace-checkbox">
              <input
                type="checkbox"
                name="relatedSkillIds"
                value={option.id}
                defaultChecked={
                  knowledge?.relatedSkillIds.includes(option.id) ?? false
                }
              />
              <span>{option.title}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="candidate-review-actions__buttons">
        <button
          type="submit"
          className="action-button action-button--accent"
          disabled={isPending}
        >
          {isEditing ? "保存知识条目" : "创建知识草稿"}
        </button>
      </div>

      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </form>
  );
}
