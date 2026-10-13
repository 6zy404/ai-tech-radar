import { contentBodyToPlainText } from "@/lib/content-body";
import { containsInternalPublicCopy } from "@/lib/public-copy";
import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "@/lib/repositories/local-json-store";
import { getWeeklyReview } from "@/lib/weekly-review";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";

/**
 * 本周总结: the one editor-written paragraph on a weekly review. The review
 * itself stays a pure derived view (`weekly-review.ts`); this is the only
 * persisted thing about a week — one record per week, keyed by the week's
 * canonical Monday, `draft` or `published`.
 *
 * Stored in `config/weekly-summaries.json` (tracked, like the digests: it is
 * editorial content); under the SQLite driver it is one `runtime_configs`
 * row, like the triage suggestions, because the store is one small object.
 *
 * Readers get the text of a published record and nothing else
 * (`getPublishedWeeklySummaryText`): no status, timestamps or AI metadata.
 * A published summary is editor-confirmed, so it carries no AI disclaimer.
 */

export type WeeklySummaryStatus = "draft" | "published";

export interface WeeklySummaryRecord {
  /** The week's Monday, `YYYY-MM-DD` — the same key as /digest/weekly/[week]. */
  weekKey: string;
  status: WeeklySummaryStatus;
  /** Paragraphs and `**bold**` only; rendered through ContentBody. */
  text: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface WeeklySummaryStore {
  updatedAt: string;
  records: WeeklySummaryRecord[];
}

export const weeklySummaryStoreFileName = "weekly-summaries.json";
export const WEEKLY_SUMMARY_MAX_CHARS = 1200;

const emptyStore = (): WeeklySummaryStore => ({ updatedAt: "", records: [] });

function storePath(): string {
  return getLocalStoreFilePath(weeklySummaryStoreFileName);
}

function isRecord(value: unknown): value is WeeklySummaryRecord {
  const record = value as Partial<WeeklySummaryRecord> | undefined;

  return (
    typeof record?.weekKey === "string" &&
    (record.status === "draft" || record.status === "published") &&
    typeof record.text === "string"
  );
}

export function readWeeklySummaryStore(): WeeklySummaryStore {
  const store = readLocalJsonFile<WeeklySummaryStore>(
    storePath(),
    emptyStore()
  );

  return {
    updatedAt: typeof store?.updatedAt === "string" ? store.updatedAt : "",
    records: Array.isArray(store?.records) ? store.records.filter(isRecord) : []
  };
}

function writeWeeklySummaryStore(records: WeeklySummaryRecord[]): void {
  writeLocalJsonFile(storePath(), {
    updatedAt: new Date().toISOString(),
    records: [...records].sort((a, b) => b.weekKey.localeCompare(a.weekKey))
  } satisfies WeeklySummaryStore);
}

export function getWeeklySummaries(): WeeklySummaryRecord[] {
  return readWeeklySummaryStore().records;
}

export function getWeeklySummary(
  weekKey: string
): WeeklySummaryRecord | undefined {
  return getWeeklySummaries().find((record) => record.weekKey === weekKey);
}

/**
 * The public reading of a week's summary: the text of a published record,
 * or nothing. Text that trips the internal-copy guard is withheld, the same
 * rule the digest pages apply to an editorial summary.
 */
export function getPublishedWeeklySummaryText(
  weekKey: string,
  records: WeeklySummaryRecord[] = getWeeklySummaries()
): string | undefined {
  const record = records.find((entry) => entry.weekKey === weekKey);
  const text = record?.status === "published" ? record.text.trim() : "";

  return text && !containsInternalPublicCopy(text) ? text : undefined;
}

/** The same, flattened for RSS and other plain-text surfaces. */
export function getPublishedWeeklySummaryPlainText(
  weekKey: string,
  records?: WeeklySummaryRecord[]
): string | undefined {
  const text = getPublishedWeeklySummaryText(weekKey, records);

  return text ? contentBodyToPlainText(text) : undefined;
}

export class WeeklySummaryError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/** A canonical Monday key of a week that has at least one shown signal. */
function requireWeek(weekKey: string) {
  const week = getWeeklyReview(weekKey);

  if (!week) {
    throw new WeeklySummaryError("周的 key 必须是那一周周一的日期。", 400);
  }

  if (week.totalCount === 0) {
    throw new WeeklySummaryError(
      "这一周没有展示的信号，公开页不存在，不能写总结。",
      409
    );
  }

  return week;
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Creates the week's record as a draft, or replaces its text. A published
 * record stays published: the edit reaches readers on save, as an edit to
 * a published digest does.
 */
export function saveWeeklySummaryText(
  weekKey: string,
  text: string
): WeeklySummaryRecord {
  requireWeek(weekKey);
  const nextText = normalizeText(text);

  if (nextText.length > WEEKLY_SUMMARY_MAX_CHARS) {
    throw new WeeklySummaryError(
      `总结最多 ${WEEKLY_SUMMARY_MAX_CHARS} 字。`,
      400
    );
  }

  const records = getWeeklySummaries();
  const existing = records.find((record) => record.weekKey === weekKey);
  const now = new Date().toISOString();
  const next: WeeklySummaryRecord = existing
    ? { ...existing, text: nextText, updatedAt: now }
    : {
        weekKey,
        status: "draft",
        text: nextText,
        createdAt: now,
        updatedAt: now
      };

  writeWeeklySummaryStore([
    ...records.filter((record) => record.weekKey !== weekKey),
    next
  ]);
  tryRecordWorkflowEvent({
    entityType: "weekly_summary",
    entityId: weekKey,
    action: existing ? "weekly_summary.updated" : "weekly_summary.created",
    actorType: "workspace_user",
    beforeSnapshot: existing,
    afterSnapshot: next
  });

  return next;
}

/** Reasons a summary cannot be published, empty when it can. */
export function getWeeklySummaryPublishBlockers(
  record: Pick<WeeklySummaryRecord, "text"> | undefined
): string[] {
  const text = record?.text.trim() ?? "";

  if (!text) {
    return ["总结是空的。"];
  }

  return containsInternalPublicCopy(text)
    ? [
        "总结里有 demo / mock / test 之类的英文词，公开页会把它整段隐藏。请改掉再发布。"
      ]
    : [];
}

export function setWeeklySummaryStatus(
  weekKey: string,
  status: WeeklySummaryStatus
): WeeklySummaryRecord {
  const records = getWeeklySummaries();
  const existing = records.find((record) => record.weekKey === weekKey);

  if (!existing) {
    throw new WeeklySummaryError("这一周还没有总结，先保存草稿。", 404);
  }

  if (status === "published") {
    requireWeek(weekKey);
    const blockers = getWeeklySummaryPublishBlockers(existing);

    if (blockers.length > 0) {
      tryRecordWorkflowEvent({
        entityType: "weekly_summary",
        entityId: weekKey,
        action: "weekly_summary.publish_failed",
        actorType: "workspace_user",
        metadata: { blockers }
      });
      throw new WeeklySummaryError(blockers.join(""), 409);
    }
  }

  const now = new Date().toISOString();
  const next: WeeklySummaryRecord = {
    ...existing,
    status,
    updatedAt: now,
    ...(status === "published" ? { publishedAt: now } : {})
  };

  writeWeeklySummaryStore([
    ...records.filter((record) => record.weekKey !== weekKey),
    next
  ]);
  tryRecordWorkflowEvent({
    entityType: "weekly_summary",
    entityId: weekKey,
    action:
      status === "published"
        ? "weekly_summary.published"
        : "weekly_summary.unpublished",
    actorType: "workspace_user",
    beforeSnapshot: existing,
    afterSnapshot: next
  });

  return next;
}
