"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { AiOverviewDraftButton } from "@/components/daily-digest-ai-summary";
import { keepListedOption } from "@/lib/listed-option";
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
    message: "简报请求失败。"
  }))) as DigestResponse;
}

export function DailyDigestEditForm({ digest }: DailyDigestEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const editorialSummaryRef = useRef<HTMLTextAreaElement>(null);

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
          throw new Error(result.message ?? "简报更新失败。");
        }

        setMessage("简报编辑字段已保存。");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "简报更新失败。");
      }
    });
  }

  return (
    <form action={saveDigest} className="detail-panel digest-edit-form">
      <div className="section-heading">
        <div>
          <p className="eyebrow">编辑字段</p>
          <h2>编辑简报文案</h2>
          <p>
            这些字段控制公开简报的文案。存在手动调整时，重新生成会保留它们。
          </p>
        </div>
      </div>

      <label className="field">
        <span>标题</span>
        <input name="title" defaultValue={digest.title} />
      </label>

      <label className="field">
        <span>摘要</span>
        <textarea name="summary" defaultValue={digest.summary} rows={3} />
      </label>

      <label className="field">
        <span>编辑概览</span>
        <textarea
          ref={editorialSummaryRef}
          name="editorialSummary"
          defaultValue={digest.editorialSummary ?? ""}
          rows={4}
          placeholder="编辑撰写的公开简报概览（可选）。"
        />
      </label>

      {/* Fills the box above from the issue's selected signals; saving is
          still the 保存简报文案 button below. */}
      <AiOverviewDraftButton
        endpoint={`/api/workspace/digests/${digest.date}/ai-summary`}
        getCurrentText={() => editorialSummaryRef.current?.value ?? ""}
        onDraft={(text) => {
          if (editorialSummaryRef.current) {
            editorialSummaryRef.current.value = text;
            editorialSummaryRef.current.focus();
          }
        }}
        disabled={isPending}
      />

      <label className="field">
        <span>编辑备注</span>
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
          {isPending ? "正在保存…" : "保存简报文案"}
        </button>
      </div>
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
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
        "把这条技术从简报中排除？重新生成简报时它会保持排除状态。"
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
          throw new Error(result.message ?? "简报条目更新失败。");
        }

        setMessage("已更新。");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "简报条目更新失败。"
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
        上移
      </button>
      <button
        type="button"
        className="action-button action-button--subtle"
        onClick={() => runAction("move_down")}
        disabled={isPending}
      >
        下移
      </button>
      <button
        type="button"
        className="action-button action-button--subtle"
        onClick={() => runAction(isPinned ? "unpin" : "pin")}
        disabled={isPending}
      >
        {isPinned ? "取消置顶" : "置顶"}
      </button>
      <button
        type="button"
        className="action-button action-button--subtle"
        onClick={() => runAction("exclude")}
        disabled={isPending}
      >
        从简报中排除
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
  // An added technology leaves the list on refresh while the state still
  // holds its id, so the id sent must follow what the select shows.
  const selectedId = keepListedOption(technologies, technologyId);

  function includeTechnology() {
    if (!selectedId) {
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
          body: JSON.stringify({
            action: "include",
            technologyId: selectedId
          })
        });
        const result = await readDigestResponse(response);

        if (!response.ok || !result.ok) {
          throw new Error(result.message ?? "手动添加失败。");
        }

        setMessage("技术已添加。");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "手动添加失败。");
      }
    });
  }

  return (
    <section className="detail-panel digest-manual-add">
      <h2>手动添加</h2>
      <p>在不改变排序规则的前提下，把已发布技术添加到这期简报。</p>
      {technologies.length > 0 ? (
        <>
          <select
            value={selectedId}
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
            {isPending ? "正在添加…" : "添加技术到简报"}
          </button>
        </>
      ) : (
        <p className="empty-state">所有已发布技术都已被选入。</p>
      )}
      {message ? (
        <p className="candidate-review-actions__message">{message}</p>
      ) : null}
    </section>
  );
}
