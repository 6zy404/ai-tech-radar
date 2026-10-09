/**
 * Does this title read as a website-defacement signature ("hacked by …")?
 *
 * Built for the real case of 2026-10-08: the 量子位 feed carried an item titled
 * `hacked by trenggalek6etar` (empty description, a defaced article page), and
 * because undecided candidates are public on the news lane it stayed in front
 * of readers until an editor rejected it.
 *
 * The rule is deliberately narrow, because it rejects without a person looking:
 *
 * - The verb must **open** the title (after stripping leading punctuation such
 *   as `~` or `[`). "How the router was hacked by researchers" is a headline;
 *   a defacer's signature starts with the claim.
 * - The verb must be followed directly by `by` (or Indonesian `oleh`), allowing
 *   the odd spacing, underscores and leetspeak defacers use (`HaCkEd   By`,
 *   `Hacked_By`, `h4ck3d by`, `hackedby`). Turkish defacers sign in English
 *   ("Hacked By …"), so no Turkish phrasing is added.
 * - The whole title must be short — at most {@link MAX_SIGNATURE_WORDS} words. A
 *   signature is a handle and maybe a team name; a headline that happens to
 *   begin "Owned by the community: …" runs longer.
 *
 * Known residue: a short real headline that opens with the phrase ("Hacked by
 * AI: what we learned") would match. No such title appears in the 846 distinct
 * titles the candidate snapshot has ever held, and an editor can reopen it.
 */
const DEFACEMENT_SIGNATURE_PATTERN =
  /^(?:hacked|h[a4]ck[e3]d|defaced|d[e3]f[a4]c[e3]d|pwned|pwn3d|owned|0wned|di[\s._-]*hack(?:ed)?)[\s._\-:|]*(?:by|oleh)(?![\p{L}\p{N}])/iu;

const MAX_SIGNATURE_WORDS = 8;

const INVISIBLE_CHARACTERS = /[​-‍⁠﻿]/g;
const LEADING_NON_ALPHANUMERIC = /^[^\p{L}\p{N}]+/u;

export function isDefacementTitle(title: string | undefined): boolean {
  const normalized = (title ?? "")
    .normalize("NFKC")
    .replace(INVISIBLE_CHARACTERS, "")
    .replace(LEADING_NON_ALPHANUMERIC, "")
    .trim();

  if (!normalized) {
    return false;
  }

  return (
    normalized.split(/\s+/).length <= MAX_SIGNATURE_WORDS &&
    DEFACEMENT_SIGNATURE_PATTERN.test(normalized)
  );
}
