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
}

export function CandidateRoundActions({
  candidateId
}: CandidateRoundActionsProps) {
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
        `/api/candidates/${candidateId}/convert`
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
        { status: "rejected" }
      );

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "拒绝候选失败。");
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
