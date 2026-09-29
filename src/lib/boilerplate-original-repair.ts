import { isFeedBoilerplateOnly } from "@/lib/text-sanitize";
import type { LocalizedText, TechnologyWorkspaceRecord } from "@/types/content";

/**
 * Pure planning for `scripts/fix-boilerplate-originals.ts`. No file I/O.
 *
 * Signals converted from a link-only InfoQ item kept the feed's description as
 * their `original` text — `<div align='right'><a …>点击查看原文></a></div>`, or
 * the bare phrase once cleaned — while an editor wrote the real `zh` text. The
 * 原文 reading mode shows `original` with no fallback, so readers switching to
 * it got that one line, and keyword search indexed it.
 *
 * The fix copies `zh` over an `original` that is feed boilerplate and nothing
 * else. These sources are Chinese, so there is no other original to restore.
 * A field with real original text, a field whose `zh` is empty, and every
 * `title` are left alone, and a second run finds nothing.
 */

export interface BoilerplateOriginalChange {
  slug: string;
  status: TechnologyWorkspaceRecord["status"];
  field: "summary" | "content";
  before: string;
  after: string;
}

export interface BoilerplateOriginalSkip {
  slug: string;
  field: "summary" | "content";
  reason: string;
}

const repairedFields = ["summary", "content"] as const;

export function planBoilerplateOriginalRepair(
  records: TechnologyWorkspaceRecord[]
): {
  next: TechnologyWorkspaceRecord[];
  changes: BoilerplateOriginalChange[];
  skipped: BoilerplateOriginalSkip[];
} {
  const changes: BoilerplateOriginalChange[] = [];
  const skipped: BoilerplateOriginalSkip[] = [];

  const next = records.map((record) => {
    let repaired = record;

    for (const field of repairedFields) {
      const text: LocalizedText = record[field];

      if (!isFeedBoilerplateOnly(text.original)) {
        continue;
      }

      const zh = text.zh?.trim();

      if (!zh) {
        skipped.push({ slug: record.slug, field, reason: "中文字段为空" });
        continue;
      }

      repaired = { ...repaired, [field]: { ...text, original: text.zh } };
      changes.push({
        slug: record.slug,
        status: record.status,
        field,
        before: text.original,
        after: text.zh as string
      });
    }

    return repaired;
  });

  return { next, changes, skipped };
}
