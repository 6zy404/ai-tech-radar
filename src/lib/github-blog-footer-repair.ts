import { stripTrailingFeedSentences } from "@/lib/text-sanitize";
import type { LocalizedText, TechnologyWorkspaceRecord } from "@/types/content";

/**
 * Pure planning for `scripts/fix-github-blog-footer.ts`. No file I/O.
 *
 * GitHub Blog is WordPress, and every feed summary ends in "The post {title}
 * appeared first on The GitHub Blog." The importer strips that sentence since
 * 2026-09-30, but signals converted before then kept it in their `original`
 * (and the copied `en`) text, where the 原文 reading mode shows it. Measured
 * 2026-09-30 on a worktree copy: 1 published signal, 2 fields.
 *
 * Only published records, only `summary` and `content`, only the `original`
 * and `en` texts — `zh` is written by an editor and titles never carry it. A
 * field is changed only when the footer is its trailing sentence; a field that
 * would be left empty is skipped rather than emptied, and a second run finds
 * nothing.
 */

export interface GitHubBlogFooterChange {
  slug: string;
  field: `${RepairedField}.${RepairedLanguage}`;
  before: string;
  after: string;
}

export interface GitHubBlogFooterSkip {
  slug: string;
  field: `${RepairedField}.${RepairedLanguage}`;
  reason: string;
}

type RepairedField = (typeof repairedFields)[number];
type RepairedLanguage = (typeof repairedLanguages)[number];

const repairedFields = ["summary", "content"] as const;
const repairedLanguages = ["original", "en"] as const;

export function planGitHubBlogFooterRepair(
  records: TechnologyWorkspaceRecord[]
): {
  next: TechnologyWorkspaceRecord[];
  changes: GitHubBlogFooterChange[];
  skipped: GitHubBlogFooterSkip[];
} {
  const changes: GitHubBlogFooterChange[] = [];
  const skipped: GitHubBlogFooterSkip[] = [];

  const next = records.map((record) => {
    if (record.status !== "published") {
      return record;
    }

    let repaired = record;

    for (const field of repairedFields) {
      let text: LocalizedText = repaired[field];

      for (const language of repairedLanguages) {
        const before = text[language];

        if (!before) {
          continue;
        }

        const after = stripTrailingFeedSentences(before);

        if (after === before) {
          continue;
        }

        if (!after.trim()) {
          skipped.push({
            slug: record.slug,
            field: `${field}.${language}`,
            reason: "只剩这句样板，清掉会变空"
          });
          continue;
        }

        text = { ...text, [language]: after };
        changes.push({
          slug: record.slug,
          field: `${field}.${language}`,
          before,
          after
        });
      }

      repaired = { ...repaired, [field]: text };
    }

    return repaired;
  });

  return { next, changes, skipped };
}
