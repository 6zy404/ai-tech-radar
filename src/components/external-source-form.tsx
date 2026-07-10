"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ExternalSource } from "@/types/content";

interface ExternalSourceFormProps {
  source?: ExternalSource;
}

function getFormValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export function ExternalSourceForm({ source }: ExternalSourceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const isEditing = Boolean(source);

  function submit(formData: FormData) {
    startTransition(async () => {
      setMessage("");

      const payload = {
        name: getFormValue(formData, "name"),
        type: getFormValue(formData, "type"),
        url: getFormValue(formData, "url"),
        enabled: formData.get("enabled") === "on",
        description: getFormValue(formData, "description"),
        language: getFormValue(formData, "language"),
        publisherName: getFormValue(formData, "publisherName"),
        publisherType: getFormValue(formData, "publisherType"),
        defaultTags: getFormValue(formData, "defaultTags")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        defaultNormalizedType: getFormValue(formData, "defaultNormalizedType")
      };

      try {
        const response = await fetch(
          isEditing
            ? `/api/workspace/sources/${source?.id}`
            : "/api/workspace/sources",
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
          source?: ExternalSource;
          message?: string;
          issues?: string[];
        };

        if (!response.ok || !result.ok || !result.source) {
          throw new Error(
            result.issues?.join(" ") ?? result.message ?? "来源保存失败。"
          );
        }

        setMessage(isEditing ? "来源已更新。" : "来源已创建。");

        if (!isEditing) {
          router.push(`/workspace/sources/${result.source.id}`);
        } else {
          router.refresh();
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "来源保存失败。");
      }
    });
  }

  return (
    <form action={submit} className="source-form">
      <div className="source-form__grid">
        <label className="field">
          <span>名称</span>
          <input name="name" defaultValue={source?.name ?? ""} required />
        </label>

        <label className="field">
          <span>类型</span>
          <select name="type" defaultValue={source?.type ?? "rss"}>
            <option value="rss">RSS</option>
            <option value="atom">Atom</option>
            <option value="github_release">GitHub 版本发布</option>
            <option value="official_blog">官方博客</option>
          </select>
        </label>

        <label className="field source-form__wide">
          <span>URL</span>
          <input
            name="url"
            type="url"
            defaultValue={source?.url ?? ""}
            required
          />
        </label>

        <label className="field source-form__wide">
          <span>描述</span>
          <textarea
            name="description"
            defaultValue={source?.description ?? ""}
            rows={3}
          />
        </label>

        <label className="field">
          <span>语言</span>
          <select name="language" defaultValue={source?.language ?? "en"}>
            <option value="en">英文</option>
            <option value="zh">中文</option>
          </select>
        </label>

        <label className="field">
          <span>发布方类型</span>
          <select
            name="publisherType"
            defaultValue={source?.publisherType ?? "media"}
          >
            <option value="big-tech">大型科技公司</option>
            <option value="startup">创业公司</option>
            <option value="research-lab">研究机构</option>
            <option value="open-source-community">开源社区</option>
            <option value="media">媒体</option>
          </select>
        </label>

        <label className="field">
          <span>发布方</span>
          <input
            name="publisherName"
            defaultValue={source?.publisherName ?? ""}
            placeholder="发布方名称（可选）"
          />
        </label>

        <label className="field">
          <span>默认内容类型</span>
          <select
            name="defaultNormalizedType"
            defaultValue={source?.defaultNormalizedType ?? "unknown"}
          >
            <option value="unknown">未知</option>
            <option value="platform">平台</option>
            <option value="tool">工具</option>
            <option value="model">模型</option>
            <option value="protocol">协议</option>
            <option value="workflow">工作流</option>
          </select>
        </label>

        <label className="field source-form__wide">
          <span>默认标签</span>
          <input
            name="defaultTags"
            defaultValue={source?.defaultTags.join(", ") ?? ""}
            placeholder="agents, workflow, sdk"
          />
        </label>
      </div>

      <label className="source-form__checkbox">
        <input
          name="enabled"
          type="checkbox"
          defaultChecked={source?.enabled ?? true}
        />
        <span>启用导入</span>
      </label>

      <div className="candidate-review-actions__buttons">
        <button
          type="submit"
          className="action-button action-button--accent"
          disabled={isPending}
        >
          {isEditing ? "保存来源" : "创建来源"}
        </button>
      </div>

      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </form>
  );
}
