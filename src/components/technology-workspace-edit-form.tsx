"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import type {
  KnowledgeItem,
  SkillItem,
  TechnologyWorkspaceRecord,
  TopicTag
} from "@/types/content";

interface TechnologyWorkspaceEditFormProps {
  record: TechnologyWorkspaceRecord;
  tagOptions: TopicTag[];
  skillOptions: SkillItem[];
  knowledgeOptions: KnowledgeItem[];
}

function getFormValue(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function getFormValues(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .map((value) => String(value))
    .filter((value) => value.trim().length > 0);
}

function getEditorialNotes(formData: FormData): string[] {
  return getFormValue(formData, "editorialNotes")
    .split("\n")
    .map((note) => note.trim())
    .filter((note) => note.length > 0);
}

function getLineList(formData: FormData, name: string): string[] {
  return getFormValue(formData, name)
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function getKeyValueMap(
  formData: FormData,
  name: string
): Record<string, string> {
  return getFormValue(formData, name)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.includes(":"))
    .reduce<Record<string, string>>((result, line) => {
      const separatorIndex = line.indexOf(":");
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (key && value) {
        result[key] = value;
      }

      return result;
    }, {});
}

function formatLineList(values: string[] | undefined): string {
  return (values ?? []).join("\n");
}

function formatKeyValueMap(values: Record<string, string> | undefined): string {
  return Object.entries(values ?? {})
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

export function TechnologyWorkspaceEditForm({
  record,
  tagOptions,
  skillOptions,
  knowledgeOptions
}: TechnologyWorkspaceEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(
          `/api/workspace/technologies/${record.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              slug: getFormValue(formData, "slug"),
              title: {
                original: getFormValue(formData, "titleOriginal"),
                zh: getFormValue(formData, "titleZh")
              },
              summary: {
                original: getFormValue(formData, "summaryOriginal"),
                zh: getFormValue(formData, "summaryZh")
              },
              content: {
                original: getFormValue(formData, "contentOriginal"),
                zh: getFormValue(formData, "contentZh")
              },
              type: getFormValue(formData, "type"),
              publishDate: getFormValue(formData, "publishDate"),
              sourceName: getFormValue(formData, "sourceName"),
              sourceUrl: getFormValue(formData, "sourceUrl"),
              sourceLanguage: getFormValue(formData, "sourceLanguage"),
              translationStatus: getFormValue(formData, "translationStatus"),
              publisherName: getFormValue(formData, "publisherName"),
              publisherType: getFormValue(formData, "publisherType"),
              importanceLevel: getFormValue(formData, "importanceLevel"),
              tags: getFormValues(formData, "tags"),
              relatedKnowledgeIds: getFormValues(
                formData,
                "relatedKnowledgeIds"
              ),
              relatedSkillIds: getFormValues(formData, "relatedSkillIds"),
              editorialNotes: getEditorialNotes(formData),
              whyItMatters: getFormValue(formData, "whyItMatters"),
              whoShouldCare: getLineList(formData, "whoShouldCare"),
              technicalContext: getFormValue(formData, "technicalContext"),
              impactAreas: getLineList(formData, "impactAreas"),
              learningPath: getLineList(formData, "learningPath"),
              relatedKnowledgeExplanations: getKeyValueMap(
                formData,
                "relatedKnowledgeExplanations"
              ),
              relatedSkillExplanations: getKeyValueMap(
                formData,
                "relatedSkillExplanations"
              ),
              followUpQuestions: getLineList(formData, "followUpQuestions"),
              readingDifficulty: getFormValue(formData, "readingDifficulty"),
              intelligenceStatus: getFormValue(formData, "intelligenceStatus")
            })
          }
        );
        const result = (await response.json()) as {
          ok: boolean;
          message?: string;
        };

        if (!response.ok || !result.ok) {
          throw new Error(result.message || "草稿保存失败。");
        }

        setMessage("草稿修改已保存。");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "草稿保存失败。");
      }
    });
  }

  return (
    <form className="workspace-edit-form" onSubmit={handleSubmit}>
      <div className="workspace-edit-form__header">
        <div>
          <p className="eyebrow">内部编辑</p>
          <h2>编辑草稿以备发布</h2>
        </div>
        <button
          type="submit"
          className="action-button action-button--accent"
          disabled={isPending}
        >
          {isPending ? "正在保存…" : "保存草稿修改"}
        </button>
      </div>

      <div className="workspace-edit-form__grid">
        <label className="field">
          <span>Slug</span>
          <input name="slug" defaultValue={record.slug} />
        </label>
        <label className="field">
          <span>类型</span>
          <select name="type" defaultValue={record.type}>
            <option value="platform">平台</option>
            <option value="tool">工具</option>
            <option value="model">模型</option>
            <option value="protocol">协议</option>
            <option value="workflow">工作流</option>
          </select>
        </label>
        <label className="field">
          <span>发布日期</span>
          <input
            name="publishDate"
            type="date"
            defaultValue={record.publishDate}
          />
        </label>
      </div>

      <div className="workspace-edit-form__grid workspace-edit-form__grid--two">
        <label className="field">
          <span>原文标题</span>
          <input name="titleOriginal" defaultValue={record.title.original} />
        </label>
        <label className="field">
          <span>中文标题</span>
          <input name="titleZh" defaultValue={record.title.zh ?? ""} />
        </label>
      </div>

      <div className="workspace-edit-form__grid workspace-edit-form__grid--two">
        <label className="field">
          <span>原文摘要</span>
          <textarea
            name="summaryOriginal"
            rows={4}
            defaultValue={record.summary.original}
          />
        </label>
        <label className="field">
          <span>中文摘要</span>
          <textarea
            name="summaryZh"
            rows={4}
            defaultValue={record.summary.zh ?? ""}
          />
        </label>
      </div>

      <div className="workspace-edit-form__grid workspace-edit-form__grid--two">
        <label className="field">
          <span>原文正文</span>
          <textarea
            name="contentOriginal"
            rows={10}
            defaultValue={record.content.original}
          />
        </label>
        <label className="field">
          <span>中文正文</span>
          <textarea
            name="contentZh"
            rows={10}
            defaultValue={record.content.zh ?? ""}
          />
        </label>
      </div>

      <div className="workspace-edit-form__grid">
        <label className="field">
          <span>来源名称</span>
          <input name="sourceName" defaultValue={record.sourceName} />
        </label>
        <label className="field">
          <span>来源 URL</span>
          <input name="sourceUrl" defaultValue={record.sourceUrl} />
        </label>
        <label className="field">
          <span>发布方</span>
          <input name="publisherName" defaultValue={record.publisherName} />
        </label>
      </div>

      <div className="workspace-edit-form__grid">
        <label className="field">
          <span>发布方类型</span>
          <select name="publisherType" defaultValue={record.publisherType}>
            <option value="big-tech">大型科技公司</option>
            <option value="startup">创业公司</option>
            <option value="research-lab">研究机构</option>
            <option value="open-source-community">开源社区</option>
            <option value="media">媒体</option>
          </select>
        </label>
        <label className="field">
          <span>来源语言</span>
          <select name="sourceLanguage" defaultValue={record.sourceLanguage}>
            <option value="en">英文</option>
            <option value="zh">中文</option>
          </select>
        </label>
        <label className="field">
          <span>翻译状态</span>
          <select
            name="translationStatus"
            defaultValue={record.translationStatus}
          >
            <option value="not_needed">无需翻译</option>
            <option value="pending">待翻译</option>
            <option value="done">已完成</option>
            <option value="failed">失败</option>
          </select>
        </label>
        <label className="field">
          <span>重要程度</span>
          <select name="importanceLevel" defaultValue={record.importanceLevel}>
            <option value="signal">一般信号</option>
            <option value="important">重要</option>
            <option value="critical">关键</option>
          </select>
        </label>
      </div>

      <fieldset className="workspace-edit-form__fieldset">
        <legend>标签</legend>
        <div className="workspace-edit-form__checkbox-grid">
          {tagOptions.map((tag) => (
            <label key={tag.id} className="workspace-checkbox">
              <input
                type="checkbox"
                name="tags"
                value={tag.id}
                defaultChecked={record.tags.includes(tag.id)}
              />
              <span>{tag.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="workspace-edit-form__grid workspace-edit-form__grid--two">
        <fieldset className="workspace-edit-form__fieldset">
          <legend>关联知识</legend>
          <div className="workspace-edit-form__checkbox-list">
            {knowledgeOptions.map((item) => (
              <label key={item.id} className="workspace-checkbox">
                <input
                  type="checkbox"
                  name="relatedKnowledgeIds"
                  value={item.id}
                  defaultChecked={record.relatedKnowledgeIds.includes(item.id)}
                />
                <span>{item.title}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="workspace-edit-form__fieldset">
          <legend>关联技能</legend>
          <div className="workspace-edit-form__checkbox-list">
            {skillOptions.map((item) => (
              <label key={item.id} className="workspace-checkbox">
                <input
                  type="checkbox"
                  name="relatedSkillIds"
                  value={item.id}
                  defaultChecked={record.relatedSkillIds.includes(item.id)}
                />
                <span>{item.title}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset className="workspace-edit-form__fieldset workspace-edit-form__fieldset--intelligence">
        <legend>内容智能</legend>
        <p className="workspace-edit-form__hint">
          这些字段构成公开页面的解释层。字段缺失会产生发布警告，因为用户端页面会因此变得不够有用。
        </p>

        <div className="workspace-edit-form__grid workspace-edit-form__grid--two">
          <label className="field">
            <span>为什么值得看</span>
            <textarea
              name="whyItMatters"
              rows={4}
              defaultValue={record.whyItMatters ?? ""}
            />
          </label>
          <label className="field">
            <span>技术背景</span>
            <textarea
              name="technicalContext"
              rows={4}
              defaultValue={record.technicalContext ?? ""}
            />
          </label>
        </div>

        <div className="workspace-edit-form__grid">
          <label className="field">
            <span>阅读难度</span>
            <select
              name="readingDifficulty"
              defaultValue={record.readingDifficulty ?? "intermediate"}
            >
              <option value="beginner">入门</option>
              <option value="intermediate">进阶</option>
              <option value="advanced">高级</option>
            </select>
          </label>
          <label className="field">
            <span>内容智能状态</span>
            <select
              name="intelligenceStatus"
              defaultValue={record.intelligenceStatus ?? "needs_enrichment"}
            >
              <option value="draft">草稿</option>
              <option value="reviewed">已审核</option>
              <option value="needs_enrichment">待富化</option>
            </select>
          </label>
        </div>

        <div className="workspace-edit-form__grid workspace-edit-form__grid--two">
          <label className="field">
            <span>谁该关注</span>
            <textarea
              name="whoShouldCare"
              rows={4}
              defaultValue={formatLineList(record.whoShouldCare)}
              placeholder="AI 工程师&#10;产品负责人&#10;技术管理者"
            />
          </label>
          <label className="field">
            <span>影响领域</span>
            <textarea
              name="impactAreas"
              rows={4}
              defaultValue={formatLineList(record.impactAreas)}
              placeholder="智能体工作流&#10;开发者工具&#10;评估"
            />
          </label>
        </div>

        <div className="workspace-edit-form__grid workspace-edit-form__grid--two">
          <label className="field">
            <span>学习路径</span>
            <textarea
              name="learningPath"
              rows={5}
              defaultValue={formatLineList(record.learningPath)}
              placeholder="从官方公告开始&#10;复习关联知识条目&#10;规划一个小试点"
            />
          </label>
          <label className="field">
            <span>后续问题</span>
            <textarea
              name="followUpQuestions"
              rows={5}
              defaultValue={formatLineList(record.followUpQuestions)}
              placeholder="它会最先改变哪个工作流？&#10;哪个集成风险需要测试？"
            />
          </label>
        </div>

        <div className="workspace-edit-form__grid workspace-edit-form__grid--two">
          <label className="field">
            <span>知识关联说明</span>
            <textarea
              name="relatedKnowledgeExplanations"
              rows={5}
              defaultValue={formatKeyValueMap(
                record.relatedKnowledgeExplanations
              )}
              placeholder="knowledge-api-contracts: 解释稳定接口为何重要。"
            />
          </label>
          <label className="field">
            <span>技能关联说明</span>
            <textarea
              name="relatedSkillExplanations"
              rows={5}
              defaultValue={formatKeyValueMap(record.relatedSkillExplanations)}
              placeholder="skill-tool-integration: 帮助评估集成成本。"
            />
          </label>
        </div>
      </fieldset>

      <label className="field">
        <span>编辑备注</span>
        <textarea
          name="editorialNotes"
          rows={4}
          defaultValue={record.editorialNotes.join("\n")}
        />
      </label>

      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </form>
  );
}
