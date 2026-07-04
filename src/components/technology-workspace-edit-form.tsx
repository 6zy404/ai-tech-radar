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
          throw new Error(
            result.message || "Technology workspace save failed."
          );
        }

        setMessage("Draft edits saved.");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Technology workspace save failed."
        );
      }
    });
  }

  return (
    <form className="workspace-edit-form" onSubmit={handleSubmit}>
      <div className="workspace-edit-form__header">
        <div>
          <p className="eyebrow">Internal Editing</p>
          <h2>Edit draft for publication</h2>
        </div>
        <button
          type="submit"
          className="action-button action-button--accent"
          disabled={isPending}
        >
          {isPending ? "Saving draft edits..." : "Save draft edits"}
        </button>
      </div>

      <div className="workspace-edit-form__grid">
        <label className="field">
          <span>Slug</span>
          <input name="slug" defaultValue={record.slug} />
        </label>
        <label className="field">
          <span>Type</span>
          <select name="type" defaultValue={record.type}>
            <option value="platform">Platform</option>
            <option value="tool">Tool</option>
            <option value="model">Model</option>
            <option value="protocol">Protocol</option>
            <option value="workflow">Workflow</option>
          </select>
        </label>
        <label className="field">
          <span>Publish date</span>
          <input
            name="publishDate"
            type="date"
            defaultValue={record.publishDate}
          />
        </label>
      </div>

      <div className="workspace-edit-form__grid workspace-edit-form__grid--two">
        <label className="field">
          <span>Original title</span>
          <input name="titleOriginal" defaultValue={record.title.original} />
        </label>
        <label className="field">
          <span>Chinese title</span>
          <input name="titleZh" defaultValue={record.title.zh ?? ""} />
        </label>
      </div>

      <div className="workspace-edit-form__grid workspace-edit-form__grid--two">
        <label className="field">
          <span>Original summary</span>
          <textarea
            name="summaryOriginal"
            rows={4}
            defaultValue={record.summary.original}
          />
        </label>
        <label className="field">
          <span>Chinese summary</span>
          <textarea
            name="summaryZh"
            rows={4}
            defaultValue={record.summary.zh ?? ""}
          />
        </label>
      </div>

      <div className="workspace-edit-form__grid workspace-edit-form__grid--two">
        <label className="field">
          <span>Original content</span>
          <textarea
            name="contentOriginal"
            rows={10}
            defaultValue={record.content.original}
          />
        </label>
        <label className="field">
          <span>Chinese content</span>
          <textarea
            name="contentZh"
            rows={10}
            defaultValue={record.content.zh ?? ""}
          />
        </label>
      </div>

      <div className="workspace-edit-form__grid">
        <label className="field">
          <span>Source name</span>
          <input name="sourceName" defaultValue={record.sourceName} />
        </label>
        <label className="field">
          <span>Source URL</span>
          <input name="sourceUrl" defaultValue={record.sourceUrl} />
        </label>
        <label className="field">
          <span>Publisher</span>
          <input name="publisherName" defaultValue={record.publisherName} />
        </label>
      </div>

      <div className="workspace-edit-form__grid">
        <label className="field">
          <span>Publisher type</span>
          <select name="publisherType" defaultValue={record.publisherType}>
            <option value="big-tech">Big tech</option>
            <option value="startup">Startup</option>
            <option value="research-lab">Research lab</option>
            <option value="open-source-community">Open-source community</option>
            <option value="media">Media</option>
          </select>
        </label>
        <label className="field">
          <span>Source language</span>
          <select name="sourceLanguage" defaultValue={record.sourceLanguage}>
            <option value="en">English</option>
            <option value="zh">Chinese</option>
          </select>
        </label>
        <label className="field">
          <span>Translation status</span>
          <select
            name="translationStatus"
            defaultValue={record.translationStatus}
          >
            <option value="not_needed">Not needed</option>
            <option value="pending">Pending</option>
            <option value="done">Done</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <label className="field">
          <span>Importance</span>
          <select name="importanceLevel" defaultValue={record.importanceLevel}>
            <option value="signal">Signal</option>
            <option value="important">Important</option>
            <option value="critical">Critical</option>
          </select>
        </label>
      </div>

      <fieldset className="workspace-edit-form__fieldset">
        <legend>Tags</legend>
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
          <legend>Related knowledge</legend>
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
          <legend>Related skills</legend>
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
        <legend>Content Intelligence</legend>
        <p className="workspace-edit-form__hint">
          These fields shape the public explanation layer. Missing fields
          produce publish warnings because the user-facing page will be less
          useful.
        </p>

        <div className="workspace-edit-form__grid workspace-edit-form__grid--two">
          <label className="field">
            <span>Why it matters</span>
            <textarea
              name="whyItMatters"
              rows={4}
              defaultValue={record.whyItMatters ?? ""}
            />
          </label>
          <label className="field">
            <span>Technical context</span>
            <textarea
              name="technicalContext"
              rows={4}
              defaultValue={record.technicalContext ?? ""}
            />
          </label>
        </div>

        <div className="workspace-edit-form__grid">
          <label className="field">
            <span>Reading difficulty</span>
            <select
              name="readingDifficulty"
              defaultValue={record.readingDifficulty ?? "intermediate"}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="field">
            <span>Intelligence status</span>
            <select
              name="intelligenceStatus"
              defaultValue={record.intelligenceStatus ?? "needs_enrichment"}
            >
              <option value="draft">Draft</option>
              <option value="reviewed">Reviewed</option>
              <option value="needs_enrichment">Needs enrichment</option>
            </select>
          </label>
        </div>

        <div className="workspace-edit-form__grid workspace-edit-form__grid--two">
          <label className="field">
            <span>Who should care</span>
            <textarea
              name="whoShouldCare"
              rows={4}
              defaultValue={formatLineList(record.whoShouldCare)}
              placeholder="AI engineer&#10;Product builder&#10;Technical manager"
            />
          </label>
          <label className="field">
            <span>Impact areas</span>
            <textarea
              name="impactAreas"
              rows={4}
              defaultValue={formatLineList(record.impactAreas)}
              placeholder="agent workflow&#10;developer tools&#10;evaluation"
            />
          </label>
        </div>

        <div className="workspace-edit-form__grid workspace-edit-form__grid--two">
          <label className="field">
            <span>Learning path</span>
            <textarea
              name="learningPath"
              rows={5}
              defaultValue={formatLineList(record.learningPath)}
              placeholder="Start with the source announcement&#10;Review the related knowledge items&#10;Map one small pilot"
            />
          </label>
          <label className="field">
            <span>Follow-up questions</span>
            <textarea
              name="followUpQuestions"
              rows={5}
              defaultValue={formatLineList(record.followUpQuestions)}
              placeholder="What workflow would this change first?&#10;Which integration risk needs testing?"
            />
          </label>
        </div>

        <div className="workspace-edit-form__grid workspace-edit-form__grid--two">
          <label className="field">
            <span>Knowledge explanations</span>
            <textarea
              name="relatedKnowledgeExplanations"
              rows={5}
              defaultValue={formatKeyValueMap(
                record.relatedKnowledgeExplanations
              )}
              placeholder="knowledge-api-contracts: Explains why stable interfaces matter."
            />
          </label>
          <label className="field">
            <span>Skill explanations</span>
            <textarea
              name="relatedSkillExplanations"
              rows={5}
              defaultValue={formatKeyValueMap(record.relatedSkillExplanations)}
              placeholder="skill-tool-integration: Helps evaluate integration cost."
            />
          </label>
        </div>
      </fieldset>

      <label className="field">
        <span>Editorial notes</span>
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
