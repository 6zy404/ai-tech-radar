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
          isEditing ? `/api/workspace/sources/${source?.id}` : "/api/workspace/sources",
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
            result.issues?.join(" ") ??
              result.message ??
              "External source save failed."
          );
        }

        setMessage(isEditing ? "Source updated." : "Source created.");

        if (!isEditing) {
          router.push(`/workspace/sources/${result.source.id}`);
        } else {
          router.refresh();
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "External source save failed."
        );
      }
    });
  }

  return (
    <form action={submit} className="source-form">
      <div className="source-form__grid">
        <label className="field">
          <span>Name</span>
          <input name="name" defaultValue={source?.name ?? ""} required />
        </label>

        <label className="field">
          <span>Type</span>
          <select name="type" defaultValue={source?.type ?? "rss"}>
            <option value="rss">RSS</option>
            <option value="atom">Atom</option>
            <option value="github_release">GitHub Release</option>
            <option value="official_blog">Official Blog</option>
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
          <span>Description</span>
          <textarea
            name="description"
            defaultValue={source?.description ?? ""}
            rows={3}
          />
        </label>

        <label className="field">
          <span>Language</span>
          <select name="language" defaultValue={source?.language ?? "en"}>
            <option value="en">English</option>
            <option value="zh">Chinese</option>
          </select>
        </label>

        <label className="field">
          <span>Publisher type</span>
          <select
            name="publisherType"
            defaultValue={source?.publisherType ?? "media"}
          >
            <option value="big-tech">Big tech</option>
            <option value="startup">Startup</option>
            <option value="research-lab">Research lab</option>
            <option value="open-source-community">Open-source community</option>
            <option value="media">Media</option>
          </select>
        </label>

        <label className="field">
          <span>Publisher</span>
          <input
            name="publisherName"
            defaultValue={source?.publisherName ?? ""}
            placeholder="Optional publisher name"
          />
        </label>

        <label className="field">
          <span>Default normalized type</span>
          <select
            name="defaultNormalizedType"
            defaultValue={source?.defaultNormalizedType ?? "unknown"}
          >
            <option value="unknown">Unknown</option>
            <option value="platform">Platform</option>
            <option value="tool">Tool</option>
            <option value="model">Model</option>
            <option value="protocol">Protocol</option>
            <option value="workflow">Workflow</option>
          </select>
        </label>

        <label className="field source-form__wide">
          <span>Default tags</span>
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
        <span>Enabled for imports</span>
      </label>

      <div className="candidate-review-actions__buttons">
        <button
          type="submit"
          className="action-button action-button--accent"
          disabled={isPending}
        >
          {isEditing ? "Save source" : "Create source"}
        </button>
      </div>

      {message ? <p className="candidate-review-actions__message">{message}</p> : null}
    </form>
  );
}
