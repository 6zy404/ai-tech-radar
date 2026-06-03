"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { DailyDigest, TechnologyItem } from "@/types/content";

interface DigestResponse {
  ok: boolean;
  message?: string;
  digest?: DailyDigest;
}

interface DailyDigestEditFormProps {
  digest: DailyDigest;
}

interface DailyDigestItemActionsProps {
  date: string;
  technologyId: string;
  isPinned: boolean;
}

interface DailyDigestManualAddProps {
  date: string;
  technologies: TechnologyItem[];
}

async function readDigestResponse(response: Response): Promise<DigestResponse> {
  return (await response.json().catch(() => ({
    ok: false,
    message: "Digest request failed."
  }))) as DigestResponse;
}

export function DailyDigestEditForm({ digest }: DailyDigestEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function saveDigest(formData: FormData) {
    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(`/api/workspace/digests/${digest.date}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: String(formData.get("title") ?? ""),
            summary: String(formData.get("summary") ?? ""),
            editorialSummary: String(formData.get("editorialSummary") ?? ""),
            editorialNotes: String(formData.get("editorialNotes") ?? "")
          })
        });
        const result = await readDigestResponse(response);

        if (!response.ok || !result.ok) {
          throw new Error(result.message ?? "Digest update failed.");
        }

        setMessage("Digest editorial fields saved.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Digest update failed.");
      }
    });
  }

  return (
    <form action={saveDigest} className="detail-panel digest-edit-form">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Editorial Fields</p>
          <h2>Edit digest copy</h2>
          <p>
            These fields control the public digest copy. Regenerate keeps them
            when manual adjustments exist.
          </p>
        </div>
      </div>

      <label className="field">
        <span>Title</span>
        <input name="title" defaultValue={digest.title} />
      </label>

      <label className="field">
        <span>Summary</span>
        <textarea name="summary" defaultValue={digest.summary} rows={3} />
      </label>

      <label className="field">
        <span>Editorial summary</span>
        <textarea
          name="editorialSummary"
          defaultValue={digest.editorialSummary ?? ""}
          rows={4}
          placeholder="Optional editor-written overview for the public digest."
        />
      </label>

      <label className="field">
        <span>Editorial notes</span>
        <textarea
          name="editorialNotes"
          defaultValue={digest.editorialNotes.join("\n")}
          rows={4}
        />
      </label>

      <div className="candidate-review-actions__buttons">
        <button
          type="submit"
          className="action-button action-button--accent"
          disabled={isPending}
        >
          {isPending ? "Saving..." : "Save digest copy"}
        </button>
      </div>
      {message ? <p className="candidate-review-actions__message">{message}</p> : null}
    </form>
  );
}

export function DailyDigestItemActions({
  date,
  technologyId,
  isPinned
}: DailyDigestItemActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function runAction(action: string) {
    if (
      action === "exclude" &&
      !window.confirm(
        "Exclude this technology from the digest? It will stay excluded when the digest is regenerated."
      )
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(`/api/workspace/digests/${date}/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ action, technologyId })
        });
        const result = await readDigestResponse(response);

        if (!response.ok || !result.ok) {
          throw new Error(result.message ?? "Digest item update failed.");
        }

        setMessage("Updated.");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Digest item update failed."
        );
      }
    });
  }

  return (
    <div className="digest-item-actions">
      <button
        type="button"
        className="action-button action-button--subtle"
        onClick={() => runAction("move_up")}
        disabled={isPending}
      >
        Move up
      </button>
      <button
        type="button"
        className="action-button action-button--subtle"
        onClick={() => runAction("move_down")}
        disabled={isPending}
      >
        Move down
      </button>
      <button
        type="button"
        className="action-button action-button--subtle"
        onClick={() => runAction(isPinned ? "unpin" : "pin")}
        disabled={isPending}
      >
        {isPinned ? "Unpin" : "Pin"}
      </button>
      <button
        type="button"
        className="action-button action-button--subtle"
        onClick={() => runAction("exclude")}
        disabled={isPending}
      >
        Exclude from digest
      </button>
      {message ? <span>{message}</span> : null}
    </div>
  );
}

export function DailyDigestManualAdd({
  date,
  technologies
}: DailyDigestManualAddProps) {
  const router = useRouter();
  const [technologyId, setTechnologyId] = useState(technologies[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function includeTechnology() {
    if (!technologyId) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(`/api/workspace/digests/${date}/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ action: "include", technologyId })
        });
        const result = await readDigestResponse(response);

        if (!response.ok || !result.ok) {
          throw new Error(result.message ?? "Manual add failed.");
        }

        setMessage("Technology added.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Manual add failed.");
      }
    });
  }

  return (
    <section className="detail-panel digest-manual-add">
      <h2>Manual add</h2>
      <p>
        Add a published TechnologyItem to this digest without changing the
        ranking rules.
      </p>
      {technologies.length > 0 ? (
        <>
          <select
            value={technologyId}
            onChange={(event) => setTechnologyId(event.target.value)}
          >
            {technologies.map((technology) => (
              <option key={technology.id} value={technology.id}>
                {technology.title.zh ?? technology.title.original}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="action-button action-button--accent"
            onClick={includeTechnology}
            disabled={isPending}
          >
            {isPending ? "Adding technology..." : "Add technology to digest"}
          </button>
        </>
      ) : (
        <p className="empty-state">All published technologies are already selected.</p>
      )}
      {message ? <p className="candidate-review-actions__message">{message}</p> : null}
    </section>
  );
}
