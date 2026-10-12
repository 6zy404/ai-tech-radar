"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface ReadinessIssue {
  message: string;
}

interface ActionResult {
  ok: boolean;
  message?: string;
  draftId?: string;
  readiness?: { blockingErrors?: ReadinessIssue[] };
}

function readinessMessage(result: ActionResult, fallback: string): string {
  const blocking = result.readiness?.blockingErrors;

  if (blocking && blocking.length > 0) {
    return `发布被拦截：${blocking.map((issue) => issue.message).join("；")}`;
  }

  return result.message ?? fallback;
}

async function postJson(
  url: string,
  body?: Record<string, unknown>
): Promise<{ response: Response; result: ActionResult }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {})
  });
  const result = (await response
    .json()
    .catch(() => ({ ok: false }))) as ActionResult;

  return { response, result };
}

interface CandidateRoundActionsProps {
  candidateId: string;
  /** Suggestions are hidden: record the decision as blind. */
  blind?: boolean;
}

export function CandidateRoundActions({
  candidateId,
  blind = false
}: CandidateRoundActionsProps) {
  const blindBody = blind ? { blind: true } : {};
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      setMessage("");
      try {
        await action();
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "操作失败。");
      }
    });
  }

  function convert() {
    run(async () => {
      const { response, result } = await postJson(
        `/api/candidates/${candidateId}/convert`,
        blindBody
      );

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "转为草稿失败。");
      }
    });
  }

  function reject() {
    if (!window.confirm("拒绝这条候选？它将不再进入编辑轮的待决列表。")) {
      return;
    }

    run(async () => {
      const { response, result } = await postJson(
        `/api/candidates/${candidateId}/status`,
        { status: "rejected", ...blindBody }
      );

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "拒绝候选失败。");
      }
    });
  }

  // 「值得一看、暂不收录」 — the third of the three triage answers, which the
  // console could not record before, so a round had to open each candidate.
  function markReviewed() {
    run(async () => {
      const { response, result } = await postJson(
        `/api/candidates/${candidateId}/status`,
        { status: "reviewed", ...blindBody }
      );

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "标记已看失败。");
      }
    });
  }

  return (
    <div className="editorial-round-actions">
      <button
        type="button"
        className="action-button action-button--accent"
        onClick={convert}
        disabled={isPending}
      >
        转为草稿
      </button>
      <button
        type="button"
        className="action-button"
        onClick={markReviewed}
        disabled={isPending}
      >
        标记已看
      </button>
      <button
        type="button"
        className="action-button"
        onClick={reject}
        disabled={isPending}
      >
        拒绝
      </button>
      {message ? (
        <p className="editorial-round-actions__message">{message}</p>
      ) : null}
    </div>
  );
}

interface AiDraftActionProps {
  candidateId: string;
  /** Suggestions are hidden: record the conversion as blind. */
  blind?: boolean;
  /**
   * `refresh` (the console): reload, the candidate moves to 待发布草稿 and
   * the editor can start another one meanwhile. `open` (the candidate
   * page): go straight to the written draft.
   */
  afterSuccess?: "refresh" | "open";
  /** The console already has an accent button per row (转为草稿). */
  accent?: boolean;
}

/**
 * 「AI 起草」: the server reads the source, the model writes the Chinese
 * draft, and the candidate is converted with it — or, on any failure,
 * nothing changes and the reason shows here.
 */
export function AiDraftAction({
  candidateId,
  blind = false,
  afterSuccess = "refresh",
  accent = false
}: AiDraftActionProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function draft() {
    // Outside the transition: an update made inside an async transition is
    // held until the action finishes, so the editor would never see it.
    setMessage("正在读原文并起草，通常十几秒，最长两分钟……");
    startTransition(async () => {
      try {
        const { response, result } = await postJson(
          `/api/workspace/candidates/${candidateId}/ai-draft`,
          blind ? { blind: true } : {}
        );

        if (!response.ok || !result.ok || !result.draftId) {
          throw new Error(result.message ?? "AI 起草失败。");
        }

        if (afterSuccess === "open") {
          router.push(`/workspace/technologies/${result.draftId}`);
          return;
        }

        setMessage("");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "AI 起草失败。");
      }
    });
  }

  return (
    <div className="editorial-round-actions">
      <button
        type="button"
        className={`action-button${accent ? " action-button--accent" : ""}`}
        onClick={draft}
        disabled={isPending}
      >
        {isPending ? "起草中…" : "AI 起草"}
      </button>
      {message ? (
        <p className="editorial-round-actions__message" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

interface DraftPublishActionProps {
  draftId: string;
}

export function DraftPublishAction({ draftId }: DraftPublishActionProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function publish() {
    if (!window.confirm("发布这条技术草稿？发布前会运行发布质量门。")) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      try {
        const { response, result } = await postJson(
          `/api/workspace/technologies/${draftId}/status`,
          { status: "published" }
        );

        if (!response.ok || !result.ok) {
          throw new Error(readinessMessage(result, "发布技术失败。"));
        }

        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "发布技术失败。");
      }
    });
  }

  return (
    <div className="editorial-round-actions">
      <button
        type="button"
        className="action-button action-button--accent"
        onClick={publish}
        disabled={isPending}
      >
        发布
      </button>
      {message ? (
        <p className="editorial-round-actions__message">{message}</p>
      ) : null}
    </div>
  );
}

interface DigestRoundActionsProps {
  date: string;
  hasDigest: boolean;
  isPublished: boolean;
}

export function DigestRoundActions({
  date,
  hasDigest,
  isPublished
}: DigestRoundActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      setMessage("");
      try {
        const { response, result } = await postJson(
          "/api/workspace/digests/generate",
          { date }
        );

        if (!response.ok || !result.ok) {
          throw new Error(result.message ?? "生成简报草稿失败。");
        }

        setMessage("今日简报草稿已生成。");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "生成简报草稿失败。"
        );
      }
    });
  }

  function publish() {
    if (!window.confirm("发布今日简报？发布前会运行简报发布检查。")) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      try {
        const { response, result } = await postJson(
          `/api/workspace/digests/${date}/status`,
          { status: "published" }
        );

        if (!response.ok || !result.ok) {
          throw new Error(readinessMessage(result, "发布简报失败。"));
        }

        setMessage("今日简报已发布。");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "发布简报失败。");
      }
    });
  }

  return (
    <div className="editorial-round-actions">
      {hasDigest ? (
        <button
          type="button"
          className="action-button"
          onClick={generate}
          disabled={isPending}
        >
          重新生成草稿
        </button>
      ) : (
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={generate}
          disabled={isPending}
        >
          生成简报草稿
        </button>
      )}
      {hasDigest && !isPublished ? (
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={publish}
          disabled={isPending}
        >
          发布简报
        </button>
      ) : null}
      {message ? (
        <p className="editorial-round-actions__message">{message}</p>
      ) : null}
    </div>
  );
}

interface TriageSummary {
  generated: number;
  failed: number;
  skipped: number;
  modelName: string;
  errors: string[];
}

/**
 * Asks the model for a suggested disposition on every undecided candidate
 * that lacks one. Writes suggestions only; the editor still acts on each row.
 */
export function TriageSuggestionAction() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      setMessage("正在生成模型建议……");
      try {
        const response = await fetch("/api/workspace/triage-suggestions", {
          method: "POST"
        });
        const result = (await response.json().catch(() => ({ ok: false }))) as {
          ok: boolean;
          message?: string;
          summary?: TriageSummary;
        };

        if (!response.ok || !result.ok || !result.summary) {
          throw new Error(result.message ?? "生成模型建议失败。");
        }

        const { generated, failed, skipped, modelName, errors } =
          result.summary;
        setMessage(
          `${modelName}：新生成 ${generated} 条，已有 ${skipped} 条${failed > 0 ? `，失败 ${failed} 条（${errors.join("；")}）` : ""}。`
        );
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "操作失败。");
      }
    });
  }

  return (
    <div className="editorial-round-actions">
      <button
        type="button"
        className="action-button"
        onClick={generate}
        disabled={isPending}
      >
        生成模型建议
      </button>
      {message ? (
        <p className="editorial-round-actions__message">{message}</p>
      ) : null}
    </div>
  );
}
