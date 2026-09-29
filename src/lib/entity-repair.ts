import { cleanFeedText, cleanUrl, htmlToPlainText } from "@/lib/text-sanitize";
import type {
  ImportedCandidateSnapshot,
  LocalizedText,
  TechnologyWorkspaceRecord
} from "@/types/content";

/**
 * Pure planning for `scripts/repair-entities.ts`: given a store's contents,
 * return the repaired contents and a list of what changed. No file I/O, so the
 * rules are tested directly and the script is only reading and writing.
 *
 * A field is touched only when it visibly carries markup — an HTML element
 * tag or a character reference — and only when cleaning actually changes it.
 * That makes a second run a no-op, and it keeps clean text exactly as it is:
 * `cleanFeedText` collapses whitespace, which would flatten the paragraph
 * breaks in an official-blog body that never had markup to begin with.
 */

export interface EntityRepairChange {
  file: string;
  id: string;
  field: string;
  before: string;
  after: string;
}

const markupPattern =
  /<\/?[a-zA-Z][a-zA-Z0-9-]*(?=[\s/>])[^<>]*>|&(?:#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/;

export function hasMarkup(value: string | undefined): value is string {
  return typeof value === "string" && markupPattern.test(value);
}

function repairField(
  value: string | undefined,
  clean: (value: string) => string
): string | undefined {
  if (!hasMarkup(value)) {
    return undefined;
  }

  const cleaned = clean(value);

  return cleaned === value ? undefined : cleaned;
}

export function planCandidateSnapshotRepair(
  snapshot: ImportedCandidateSnapshot,
  file = "imported-candidates.live.json"
): { next: ImportedCandidateSnapshot; changes: EntityRepairChange[] } {
  const changes: EntityRepairChange[] = [];
  const fields = [
    ["sourceUrl", cleanUrl],
    ["originalTitle", htmlToPlainText],
    ["originalSummary", cleanFeedText],
    ["originalContent", cleanFeedText]
  ] as const;

  const candidates = snapshot.candidates.map((candidate) => {
    let next = candidate;

    for (const [field, clean] of fields) {
      const before = candidate[field];
      const after = repairField(before, clean);

      if (after !== undefined && before !== undefined) {
        next = { ...next, [field]: after };
        changes.push({ file, id: candidate.id, field, before, after });
      }
    }

    return next;
  });

  return { next: { ...snapshot, candidates }, changes };
}

export interface TechnologyRepairOptions {
  /**
   * Also clean `title` / `summary` / `content` in the `original` and `en`
   * languages. Off by default: these are editorial fields, and the task that
   * added this repair was scoped to links. A field that would clean down to
   * nothing — InfoQ's link-only summary — is left for an editor.
   */
  publishedText?: boolean;
}

const localizedFields = ["title", "summary", "content"] as const;
const repairedLanguages = ["original", "en"] as const;

export function planTechnologyRecordsRepair(
  records: TechnologyWorkspaceRecord[],
  options: TechnologyRepairOptions = {},
  file = "technology-workspace.json"
): { next: TechnologyWorkspaceRecord[]; changes: EntityRepairChange[] } {
  const changes: EntityRepairChange[] = [];

  const next = records.map((record) => {
    let repaired = record;
    const sourceUrl = repairField(record.sourceUrl, cleanUrl);

    if (sourceUrl !== undefined) {
      repaired = { ...repaired, sourceUrl };
      changes.push({
        file,
        id: record.slug,
        field: "sourceUrl",
        before: record.sourceUrl,
        after: sourceUrl
      });
    }

    if (record.sourceReferences?.length) {
      let referencesChanged = false;
      const sourceReferences = record.sourceReferences.map(
        (reference, index) => {
          const url = repairField(reference.sourceUrl, cleanUrl);

          if (url === undefined) {
            return reference;
          }

          referencesChanged = true;
          changes.push({
            file,
            id: record.slug,
            field: `sourceReferences[${index}].sourceUrl`,
            before: reference.sourceUrl,
            after: url
          });

          return { ...reference, sourceUrl: url };
        }
      );

      if (referencesChanged) {
        repaired = { ...repaired, sourceReferences };
      }
    }

    if (options.publishedText) {
      for (const field of localizedFields) {
        const text: LocalizedText = repaired[field];
        let nextText = text;

        for (const language of repairedLanguages) {
          const before = text[language];
          const after = repairField(before, cleanFeedText);

          if (after === undefined || before === undefined || !after) {
            continue;
          }

          nextText = { ...nextText, [language]: after };
          changes.push({
            file,
            id: record.slug,
            field: `${field}.${language}`,
            before,
            after
          });
        }

        if (nextText !== text) {
          repaired = { ...repaired, [field]: nextText };
        }
      }
    }

    return repaired;
  });

  return { next, changes };
}
