// Moving the read / read-later marks (`reading-state.ts`) to another device
// without an account. The reader copies a "阅读码" out of one browser and
// pastes it into another; nothing passes through the server, the same
// boundary the 关注码 in `my-radar-content.tsx` already keeps.
//
// Format, version 1:  rm1:s=<key>.<key>…;r=<key>.<key>…
//   s  read-later marks, oldest first (the order the store keeps)
//   r  read marks
//
// A key is `toVisitKey(id)`, a 32-bit FNV-1a hash in base 36 (≤ 7
// characters). Signal ids average 77 characters and run to 137 (measured
// 2026-09-30 over 92 published signals), so a code of raw ids would be
// eleven times longer and could not be pasted into a phone comfortably. A
// key cannot be read back into an id on its own, so the importing page
// resolves it against the published signals it already holds: a key that
// matches none (unknown, or archived since the export) or more than one
// (a hash collision) is ignored and counted, never guessed.
//
// This module is pure — the component reads and writes the store.

import { toVisitKey } from "@/lib/visit-state";

export interface ReadingMarks {
  savedIds: string[];
  readIds: string[];
}

export const readingCodePrefix = "rm1:";

const keyPattern = /^[0-9a-z]{1,7}$/;

function uniqueKnown(ids: string[], known: Set<string>): string[] {
  return Array.from(new Set(ids)).filter((id) => known.has(id));
}

/**
 * Pure core: the code for the given marks. Only ids that are still published
 * are written — a mark on an archived signal could never be restored anyway.
 */
export function encodeReadingCode(
  marks: ReadingMarks,
  publishedIds: string[]
): string {
  const known = new Set(publishedIds);
  const saved = uniqueKnown(marks.savedIds, known).map(toVisitKey);
  const read = uniqueKnown(marks.readIds, known).map(toVisitKey);

  return `${readingCodePrefix}s=${saved.join(".")};r=${read.join(".")}`;
}

/** How many marks a code for these marks would carry (0 → nothing to export). */
export function countExportableMarks(
  marks: ReadingMarks,
  publishedIds: string[]
): number {
  const known = new Set(publishedIds);

  return (
    uniqueKnown(marks.savedIds, known).length +
    uniqueKnown(marks.readIds, known).length
  );
}

export interface DecodedReadingCode {
  savedKeys: string[];
  readKeys: string[];
  /** Tokens that are not a well-formed key — typos in a hand-copied code. */
  malformedCount: number;
}

/**
 * Pure core: splits a pasted code into keys. Forgiving about what copying
 * does to text — surrounding or embedded whitespace, line breaks, upper
 * case, full-width punctuation from a Chinese input method — and strict
 * about everything else: no prefix, an unknown section or an empty code
 * returns null.
 */
export function decodeReadingCode(raw: string): DecodedReadingCode | null {
  const text = raw.normalize("NFKC").replace(/\s+/g, "").toLowerCase();

  if (!text.startsWith(readingCodePrefix)) {
    return null;
  }

  const decoded: DecodedReadingCode = {
    savedKeys: [],
    readKeys: [],
    malformedCount: 0
  };

  for (const section of text.slice(readingCodePrefix.length).split(";")) {
    if (!section) {
      continue;
    }

    const match = /^([sr])=(.*)$/.exec(section);

    if (!match) {
      return null;
    }

    const target = match[1] === "s" ? decoded.savedKeys : decoded.readKeys;

    for (const token of match[2].split(".")) {
      if (!token) {
        continue;
      }

      if (keyPattern.test(token)) {
        target.push(token);
      } else {
        decoded.malformedCount += 1;
      }
    }
  }

  if (
    decoded.savedKeys.length +
      decoded.readKeys.length +
      decoded.malformedCount ===
    0
  ) {
    return null;
  }

  return decoded;
}

export interface ReadingImportResult {
  /** The marks to write back: local marks first, imported ones appended. */
  next: ReadingMarks;
  addedSaved: number;
  addedRead: number;
  /** Marks in the code that this browser already had. */
  alreadyPresent: number;
  /** Keys that matched no published signal, matched two, or were malformed. */
  ignored: number;
}

/**
 * Pure core: resolves a decoded code against the published signals and
 * merges it into the local marks. Merging never removes a local mark and
 * keeps the local order; a newly imported read-later mark is appended, so
 * it shows as recently saved — the same place a mark made today would go.
 */
export function mergeReadingCode(
  decoded: DecodedReadingCode,
  publishedIds: string[],
  local: ReadingMarks
): ReadingImportResult {
  const idsByKey = new Map<string, string[]>();

  for (const id of new Set(publishedIds)) {
    const key = toVisitKey(id);
    idsByKey.set(key, [...(idsByKey.get(key) ?? []), id]);
  }

  let ignored = decoded.malformedCount;
  let alreadyPresent = 0;

  const mergeInto = (localIds: string[], keys: string[]) => {
    const merged = [...localIds];
    const present = new Set(localIds);
    let added = 0;

    for (const key of new Set(keys)) {
      const matches = idsByKey.get(key);

      if (!matches || matches.length !== 1) {
        ignored += 1;
        continue;
      }

      const id = matches[0];

      if (present.has(id)) {
        alreadyPresent += 1;
        continue;
      }

      merged.push(id);
      present.add(id);
      added += 1;
    }

    return { merged, added };
  };

  const saved = mergeInto(local.savedIds, decoded.savedKeys);
  const read = mergeInto(local.readIds, decoded.readKeys);

  return {
    next: { savedIds: saved.merged, readIds: read.merged },
    addedSaved: saved.added,
    addedRead: read.added,
    alreadyPresent,
    ignored
  };
}

/** Pure core: the one-line result the reader sees after an import. */
export function describeReadingImport(result: ReadingImportResult): string {
  const added = result.addedSaved + result.addedRead;
  const parts: string[] = [];

  if (added > 0) {
    const kinds = [
      result.addedSaved > 0 ? `稍后读 ${result.addedSaved}` : "",
      result.addedRead > 0 ? `已读 ${result.addedRead}` : ""
    ].filter(Boolean);

    parts.push(`导入 ${added} 条（${kinds.join(" · ")}）`);
  } else {
    parts.push("没有新的标记");
  }

  if (result.alreadyPresent > 0) {
    parts.push(`${result.alreadyPresent} 条本机已有`);
  }

  if (result.ignored > 0) {
    parts.push(`忽略 ${result.ignored} 条无法识别或已下线的信号`);
  }

  return `${parts.join("，")}。`;
}
