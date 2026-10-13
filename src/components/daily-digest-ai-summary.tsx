"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * 「AI 起草导语」 controls, workspace-only. Every one of them only fills a box:
 * the draft is saved when the editor clicks a save button, never by the
 * request that produced it.
 */

interface OverviewDraftResponse {
  ok: boolean;
  message?: string;
  text?: string;
  warnings?: string[];
  modelName?: string;
  promptVersion?: string;
  totalTokens?: number;
  latencyMs?: number;
}

export interface OverviewDraft {
  text: string;
  warnings: string[];
  /** 「模型 · 提示词版本 · tokens · 秒」, for the editor only. */
  provenance: string;
}

function describeProvenance(result: OverviewDraftResponse): string {
  const seconds =
    typeof result.latencyMs === "number"
      ? `${Math.round(result.latencyMs / 100) / 10} 秒`
      : "";

  return [
    result.modelName,
    result.promptVersion,
    result.totalTokens ? `${result.totalTokens} tokens` : "",
    seconds
  ]
    .filter(Boolean)
    .join(" · ");
}

/** POSTs to an ai-summary endpoint and hands the draft back. */
export async function requestOverviewDraft(
  endpoint: string
): Promise<OverviewDraft> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  const result = (await response.json().catch(() => ({
    ok: false
  }))) as OverviewDraftResponse;

  if (!response.ok || !result.ok || !result.text) {
    throw new Error(result.message ?? "AI 起草导语失败。");
  }

  return {
    text: result.text,
    warnings: result.warnings ?? [],
    provenance: describeProvenance(result)
  };
}

export function OverviewDraftNotes({ draft }: { draft: OverviewDraft }) {
  return (
    <div className="ai-overview-draft__notes">
      <p>AI 起草 · {draft.provenance}。没有保存：核对事实与数字后再保存。</p>
      {draft.warnings.length > 0 ? (
        <ul>
          {draft.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The button beside an editor's own textarea (the digest form's 编辑概览,
 * the weekly summary form): the draft replaces the box's text — after a
 * confirm when the box already holds something — and is not saved.
 */
export function AiOverviewDraftButton({
  endpoint,
  getCurrentText,
  onDraft,
  disabled = false
}: {
  endpoint: string;
  getCurrentText: () => string;
  onDraft: (text: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<OverviewDraft | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      setMessage("");
      setDraft(null);

      try {
        const next = await requestOverviewDraft(endpoint);
        const current = getCurrentText().trim();

        if (
          current &&
          current !== next.text &&
          !window.confirm("用 AI 草稿替换框里现有的导语？替换后还没有保存。")
        ) {
          setMessage("已取消，框里的导语没有变。");
          return;
        }

        onDraft(next.text);
        setDraft(next);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "AI 起草导语失败。"
        );
      }
    });
  }

  return (
    <div className="ai-overview-draft">
      <button
        type="button"
        className="action-button"
        onClick={run}
        disabled={disabled || isPending}
      >
        {isPending ? "正在起草…（约半分钟）" : "AI 起草导语"}
      </button>
      {draft ? <OverviewDraftNotes draft={draft} /> : null}
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </div>
  );
}

/**
 * The editorial-round console has no 编辑概览 box of its own, so this one
 * opens one: the draft lands in an editable textarea, and 保存为导语 PATCHes
 * only `editorialSummary`. Replacing an existing summary asks first.
 */
export function DigestSummaryRoundAction({
  date,
  currentSummary
}: {
  date: string;
  currentSummary: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<OverviewDraft | null>(null);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      setMessage("");

      try {
        const next = await requestOverviewDraft(
          `/api/workspace/digests/${date}/ai-summary`
        );
        setDraft(next);
        setText(next.text);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "AI 起草导语失败。"
        );
      }
    });
  }

  function save() {
    if (
      currentSummary.trim() &&
      !window.confirm("这期简报已经有编辑概览。用框里的文字替换它？")
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch(`/api/workspace/digests/${date}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editorialSummary: text })
        });
        const result = (await response.json().catch(() => ({
          ok: false
        }))) as { ok: boolean; message?: string };

        if (!response.ok || !result.ok) {
          throw new Error(result.message ?? "保存导语失败。");
        }

        setDraft(null);
        setText("");
        setMessage("导语已保存为这期简报的编辑概览。");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存导语失败。");
      }
    });
  }

  return (
    <div className="ai-overview-draft">
      <div className="editorial-round-actions">
        <button
          type="button"
          className="action-button"
          onClick={generate}
          disabled={isPending}
        >
          {isPending && !draft
            ? "正在起草…（约半分钟）"
            : currentSummary.trim()
              ? "AI 重写导语"
              : "AI 起草导语"}
        </button>
      </div>
      {draft ? (
        <>
          <label className="field">
            <span>导语草稿（编辑概览）</span>
            <textarea
              value={text}
              rows={6}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <OverviewDraftNotes draft={draft} />
          <div className="editorial-round-actions">
            <button
              type="button"
              className="action-button action-button--accent"
              onClick={save}
              disabled={isPending || !text.trim()}
            >
              保存为导语
            </button>
            <button
              type="button"
              className="action-button action-button--subtle"
              onClick={() => {
                setDraft(null);
                setText("");
                setMessage("已放弃草稿，没有保存。");
              }}
              disabled={isPending}
            >
              放弃
            </button>
          </div>
        </>
      ) : null}
      {message ? (
        <p className="editorial-round-actions__message">{message}</p>
      ) : null}
    </div>
  );
}
