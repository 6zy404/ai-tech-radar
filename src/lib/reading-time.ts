import { contentBodyToPlainText } from "@/lib/content-body";
import type { TechnologyContentMode } from "@/lib/technology-localization";

// Reading speeds for the 「约 N 分钟读完」 line on the signal page. Chinese is
// counted per character and English per word, because the two have no common
// unit: a Chinese sentence has no spaces to split on, and counting English by
// character would make an English body read four to five times too long.
export const CHINESE_CHARACTERS_PER_MINUTE = 400;
export const ENGLISH_WORDS_PER_MINUTE = 200;

// Han (extension A, the unified block and compatibility ideographs), kana and
// Hangul. Written as ranges rather than \p{Script=Han} because the project
// targets ES2017, where the `u`-flag property escapes are not available.
const CJK_CHARACTER = new RegExp(
  "[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]",
  "g"
);

// A latin word, including version strings and contractions (`v0.32.5`,
// `don't`, `open-source`), so they count once rather than once per fragment.
// Punctuation and Markdown markers match nothing, so they never count.
const LATIN_WORD = /[A-Za-z0-9]+(?:['’._-][A-Za-z0-9]+)*/g;

export interface ReadingUnits {
  chineseCharacters: number;
  englishWords: number;
}

export function countReadingUnits(text: string): ReadingUnits {
  const chineseCharacters = text.match(CJK_CHARACTER)?.length ?? 0;
  const englishWords =
    text.replace(CJK_CHARACTER, " ").match(LATIN_WORD)?.length ?? 0;

  return { chineseCharacters, englishWords };
}

// `body` is an editorial body in the ContentBody subset (## headings, **bold**,
// `code`, lists), flattened by the same parser the page renders it with, so a
// list number or a heading marker is never counted as a word. `texts` are
// plain strings shown on the page as-is. The two languages are timed
// separately and added, then rounded up; a page always takes at least a
// minute.
export function estimateReadingMinutes(
  body: string,
  texts: readonly string[] = []
): number {
  const units = [contentBodyToPlainText(body), ...texts]
    .map(countReadingUnits)
    .reduce(
      (total, next) => ({
        chineseCharacters: total.chineseCharacters + next.chineseCharacters,
        englishWords: total.englishWords + next.englishWords
      }),
      { chineseCharacters: 0, englishWords: 0 }
    );

  const minutes =
    units.chineseCharacters / CHINESE_CHARACTERS_PER_MINUTE +
    units.englishWords / ENGLISH_WORDS_PER_MINUTE;

  return Math.max(1, Math.ceil(minutes));
}

export function formatReadingTime(
  minutes: number,
  mode: TechnologyContentMode
): string {
  return mode === "original"
    ? `About ${minutes} min read`
    : `约 ${minutes} 分钟读完`;
}
