// The other direction of the signal body's knowledge links (2026-10-12): on a
// knowledge page, the published signals whose body mentions the concept.
//
// "Mentions" means exactly "the signal page links it": the body is walked the
// way ContentBody walks it — headings and inline code skipped, every other
// text run through one createKnowledgeLinker in reading order — so the two
// pages cannot disagree. No matching rule of its own lives here.
//
// Read on the body the signal page shows first (getPreferredTechnologyText),
// because the excerpt quotes it. Pure: the caller passes the published
// signals and the link targets, nothing is stored.

import { parseContentBody, splitContentBodyInline } from "@/lib/content-body";
import {
  createKnowledgeLinker,
  mentionsKnowledgeTarget,
  type KnowledgeLinkTarget
} from "@/lib/knowledge-autolink";
import { excerptAroundTerms } from "@/lib/search-original-title";
import {
  getPreferredTechnologyText,
  getPreferredTechnologyTitle
} from "@/lib/technology-localization";
import type { TechnologyItem } from "@/types/content";

/** Characters an excerpt may take, ellipses included. */
export const mentionExcerptMaxLength = 80;

export interface BodyMention {
  /** The text run (paragraph or list item) holding the link, markup removed. */
  run: string;
  /** Where the linked phrase sits in `run`. */
  start: number;
  end: number;
}

/**
 * Every knowledge item the body links, with the run and offsets of its one
 * link. `targets` should be every target, as on the signal page: which item
 * wins an overlapping phrase depends on the others.
 */
export function findBodyMentions(
  body: string,
  targets: KnowledgeLinkTarget[]
): Map<string, BodyMention> {
  const mentions = new Map<string, BodyMention>();
  if (!body || targets.length === 0) return mentions;

  const linker = createKnowledgeLinker(targets);
  const idByHref = new Map(targets.map((target) => [target.href, target.id]));

  for (const block of parseContentBody(body)) {
    if (block.kind === "heading") continue;
    const runs = block.kind === "list" ? block.items : [block.text];

    for (const run of runs) {
      const segments = splitContentBodyInline(run);
      const plain = segments.map((segment) => segment.text).join("");
      let offset = 0;

      for (const segment of segments) {
        if (segment.kind !== "code") {
          let position = offset;
          for (const piece of linker(segment.text)) {
            const id = piece.link ? idByHref.get(piece.link.href) : undefined;
            if (id && !mentions.has(id)) {
              mentions.set(id, {
                run: plain,
                start: position,
                end: position + piece.text.length
              });
            }
            position += piece.text.length;
          }
        }
        offset += segment.text.length;
      }
    }
  }

  return mentions;
}

export interface MentionExcerpt {
  before: string;
  match: string;
  after: string;
}

/**
 * About 80 characters around the mention, cut at clauses, with the mentioned
 * phrase split out so the page can set it in bold.
 */
export function excerptMention(
  mention: BodyMention,
  maxLength = mentionExcerptMaxLength
): MentionExcerpt {
  const phrase = mention.run.slice(mention.start, mention.end);
  const lower = mention.run.toLowerCase();
  const needle = phrase.toLowerCase();

  // excerptAroundTerms centres on the phrase's first occurrence. When an
  // earlier one was not the link (an `except` phrase, a 《》 title), start the
  // text just after it so the window lands on the real one.
  let from = 0;
  for (
    let index = lower.indexOf(needle);
    index !== -1 && index < mention.start;
    index = lower.indexOf(needle, index + 1)
  ) {
    from = index + needle.length;
  }

  let excerpt = excerptAroundTerms(
    mention.run.slice(from),
    [phrase],
    maxLength - (from > 0 ? 1 : 0),
    { clauseBoundaries: true }
  );
  if (from > 0 && !excerpt.startsWith("…")) excerpt = `…${excerpt}`;

  const at = excerpt.toLowerCase().indexOf(needle);
  if (at === -1) return { before: excerpt, match: "", after: "" };
  return {
    before: excerpt.slice(0, at),
    match: excerpt.slice(at, at + phrase.length),
    after: excerpt.slice(at + phrase.length)
  };
}

export interface KnowledgeMentionRow {
  id: string;
  slug: string;
  title: string;
  publishDate: string;
  excerpt: MentionExcerpt;
}

/**
 * The signals whose body links `knowledgeId`, newest first, skipping
 * `excludeIds` (the page's hand-kept related signals). Pass published
 * signals only — the page passes getAllTechnologies().
 */
export function getKnowledgeMentions(
  knowledgeId: string,
  technologies: TechnologyItem[],
  targets: KnowledgeLinkTarget[],
  excludeIds: string[] = []
): KnowledgeMentionRow[] {
  const target = targets.find((item) => item.id === knowledgeId);
  if (!target) return [];
  const excluded = new Set(excludeIds);

  return technologies
    .filter((technology) => technology.status === "published")
    .filter((technology) => !excluded.has(technology.id))
    .flatMap((technology) => {
      const body = getPreferredTechnologyText(
        technology.content,
        technology.sourceLanguage
      );
      // Cheap first: a body that never says the phrase cannot link it.
      if (!mentionsKnowledgeTarget(body, target)) return [];
      const mention = findBodyMentions(body, targets).get(knowledgeId);
      if (!mention) return [];
      return [
        {
          id: technology.id,
          slug: technology.slug,
          title: getPreferredTechnologyTitle(technology),
          publishDate: technology.publishDate,
          excerpt: excerptMention(mention)
        }
      ];
    })
    .sort((left, right) => right.publishDate.localeCompare(left.publishDate));
}
