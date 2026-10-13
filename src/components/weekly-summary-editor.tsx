"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { AiOverviewDraftButton } from "@/components/daily-digest-ai-summary";

/**
 * Workspace-only editor for one week's 本周总结: a textarea, 「AI 起草导语」
 * that fills it, 保存草稿, and 发布 / 撤回发布. The AI draft is only text in
 * the box until 保存草稿; publishing is its own click and runs the check in
 * `getWeeklySummaryPublishBlockers`.
 */
export function WeeklySummaryEditor({
  weekKey,
  initialText,
  status,
  maxChars
}: {
  weekKey: string;
  initialText: string;
  status?: "draft" | "published";
  maxChars: number;
}) {
  const router = useRouter();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [length, setLength] = useState(initialText.length);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const base = `/api/workspace/weekly-summaries/${weekKey}`;

  async function send(url: string, method: string, body: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = (await response.json().catch(() => ({ ok: false }))) as {
      ok: boolean;
      message?: string;
    };

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? "请求失败。");
    }
  }

  function save() {
    startTransition(async () => {
      setMessage("");

      try {
        await send(base, "PUT", { text: textRef.current?.value ?? "" });
        setMessage(
          status === "published"
            ? "已保存。这一周的总结已发布，公开页已经换成新文字。"
            : "已保存为草稿，公开页还看不到。"
        );
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败。");
      }
    });
  }

  function changeStatus(next: "draft" | "published") {
    if (
      next === "published" &&
      !window.confirm(
        "发布这一周的总结？发布的是已保存的文字，框里没保存的改动不会带上。"
      )
    ) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        await send(`${base}/status`, "POST", { status: next });
        setMessage(
          next === "published"
            ? "已发布：公开周回顾和周回顾 RSS 会显示这段总结。"
            : "已撤回为草稿，公开页不再显示。"
        );
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "更新状态失败。");
      }
    });
  }

  return (
    <section className="detail-panel digest-edit-form">
      <div className="section-heading">
        <div>
          <p className="eyebrow">本周总结</p>
          <h2>编辑这一周的总结</h2>
          <p>
            发布后显示在公开周回顾的四个数字下面，也写进周回顾
            RSS。编辑确认过的文字，公开页不加「AI 未审核」声明。
          </p>
        </div>
      </div>

      <label className="field">
        <span>
          总结（{length} / {maxChars} 字，段落之间空一行，可用 **加粗**）
        </span>
        <textarea
          ref={textRef}
          defaultValue={initialText}
          rows={8}
          maxLength={maxChars}
          onChange={(event) => setLength(event.target.value.length)}
        />
      </label>

      <AiOverviewDraftButton
        endpoint={`${base}/ai-summary`}
        getCurrentText={() => textRef.current?.value ?? ""}
        onDraft={(text) => {
          if (textRef.current) {
            textRef.current.value = text;
            setLength(text.length);
            textRef.current.focus();
          }
        }}
        disabled={isPending}
      />

      <div className="candidate-review-actions__buttons">
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={save}
          disabled={isPending}
        >
          {isPending ? "正在保存…" : "保存草稿"}
        </button>
        {status === "draft" ? (
          <button
            type="button"
            className="action-button"
            onClick={() => changeStatus("published")}
            disabled={isPending}
          >
            发布总结
          </button>
        ) : null}
        {status === "published" ? (
          <button
            type="button"
            className="action-button action-button--subtle"
            onClick={() => changeStatus("draft")}
            disabled={isPending}
          >
            撤回为草稿
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </section>
  );
}
