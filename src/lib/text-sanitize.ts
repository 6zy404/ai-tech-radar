/**
 * Turns feed markup into plain text, and feed-escaped URLs into real ones.
 *
 * Every RSS / Atom importer parses with `processEntities: false`, so a feed
 * that escapes its HTML (`&lt;p&gt;…`, the norm for `<description>` and Atom
 * `<content type="html">`) reaches us one layer deeper than it looks. The old
 * `stripHtml` removed tags first and decoded entities second, which is exactly
 * backwards for that input: there were no tags to remove yet, and decoding
 * then produced them. Measured on the live candidate pool on 2026-09-29: 96 of
 * 146 candidates carried tags or entities in their text, and the public news
 * lane printed Simon Willison's `<p><a href=…>` to readers. Links went the same
 * way — nothing decoded them at all — so 16 published InfoQ signals link to
 * `?utm_source=rss&amp;utm_medium=article`.
 *
 * The fix is to alternate strip and decode until the text stops changing, with
 * two guards:
 *
 * - only tags whose name is a real HTML element are stripped, so literal angle
 *   brackets in prose (`a < b`, a `<think>` token in release notes) survive the
 *   extra rounds;
 * - entity decoding is one layer per round and the rounds are capped, so an
 *   intentionally escaped `&amp;lt;` is not unwrapped without limit.
 */

const namedEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  shy: "",
  zwj: "",
  zwnj: "",
  lsquo: "‘",
  rsquo: "’",
  sbquo: "‚",
  ldquo: "“",
  rdquo: "”",
  bdquo: "„",
  laquo: "«",
  raquo: "»",
  lsaquo: "‹",
  rsaquo: "›",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  minus: "−",
  middot: "·",
  bull: "•",
  prime: "′",
  Prime: "″",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
  times: "×",
  divide: "÷",
  plusmn: "±",
  le: "≤",
  ge: "≥",
  ne: "≠",
  asymp: "≈",
  larr: "←",
  rarr: "→",
  uarr: "↑",
  darr: "↓",
  harr: "↔",
  rArr: "⇒",
  cent: "¢",
  pound: "£",
  euro: "€",
  yen: "¥",
  sect: "§",
  para: "¶",
  dagger: "†",
  iexcl: "¡",
  iquest: "¿",
  eacute: "é",
  egrave: "è",
  aacute: "á",
  agrave: "à",
  ouml: "ö",
  uuml: "ü",
  auml: "ä",
  ccedil: "ç",
  ntilde: "ñ",
  szlig: "ß"
};

const entityPattern =
  /&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/g;

function decodeNumericEntity(body: string): string | undefined {
  const codePoint =
    body[1] === "x" || body[1] === "X"
      ? Number.parseInt(body.slice(2), 16)
      : Number.parseInt(body.slice(1), 10);

  if (
    !Number.isFinite(codePoint) ||
    codePoint <= 0 ||
    codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) {
    return undefined;
  }

  return String.fromCodePoint(codePoint);
}

/**
 * Decodes one layer of HTML character references: named ones from the table
 * above, and every decimal / hex one. An unknown name is left as written, so
 * text that merely contains `&foo;` is not damaged.
 */
export function decodeHtmlEntities(value: string): string {
  return value.replace(entityPattern, (match, body: string) => {
    const decoded =
      body[0] === "#" ? decodeNumericEntity(body) : namedEntities[body];

    return decoded ?? match;
  });
}

/**
 * UTF-8 curly apostrophes that were once read as GBK. The old decoder carried
 * these fixes; kept so the move to this module changes nothing it handled.
 */
function repairMojibakeApostrophes(value: string): string {
  return value
    .replace(/鈥檚/g, "'s")
    .replace(/鈥檙e/g, "'re")
    .replace(/鈥檝e/g, "'ve")
    .replace(/鈥檒l/g, "'ll")
    .replace(/鈥檛/g, "'t");
}

/**
 * Phrasing elements sit inside a line of text, so they are removed without a
 * gap (`<a>Congress</a>.` → `Congress.`); every other element breaks the line
 * and becomes a space. Only these names count as tags, which is what keeps a
 * literal `<think>` in release notes from being stripped.
 */
const inlineElementNames = (
  "a abbr b bdi bdo big cite code data del dfn em font g-emoji i ins kbd " +
  "mark q s samp small span strike strong sub sup time tt u var wbr"
).split(" ");
const blockElementNames = (
  "address article aside audio blockquote body br button caption center col " +
  "colgroup dd details div dl dt embed figcaption figure footer form h1 h2 " +
  "h3 h4 h5 h6 head header hr html iframe img input label li link main meta " +
  "nav noscript object ol p path picture pre section source summary svg " +
  "table tbody td tfoot th thead tr ul video"
).split(" ");

function tagPattern(names: string[]): RegExp {
  return new RegExp(`<\\/?(?:${names.join("|")})(?=[\\s/>])[^<>]*>`, "gi");
}

const inlineTagPattern = tagPattern(inlineElementNames);
const blockTagPattern = tagPattern(blockElementNames);
const nonTextBlockPattern =
  /<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->/gi;

/**
 * A tag cut off by truncation: the importers shortened summaries to 260
 * characters *before* they were cleaned, so stored text can end in
 * `(<a href="https://news.ycombinator.com/i…`. The ellipsis is kept.
 */
const truncatedTagPattern = new RegExp(
  `<\\/?(?:${[...inlineElementNames, ...blockElementNames].join("|")})(?=[\\s/]|$)[^<>]*$`,
  "i"
);

function stripHtmlTags(value: string): string {
  return value
    .replace(nonTextBlockPattern, " ")
    .replace(blockTagPattern, " ")
    .replace(inlineTagPattern, "")
    .replace(truncatedTagPattern, (fragment) =>
      fragment.endsWith("…") ? "…" : ""
    );
}

/** Escaping layers undone at most; two covers feed-escaped HTML with entities. */
const maxDecodeRounds = 3;

/**
 * Markup → one line of plain text: tags removed, entities decoded, whitespace
 * collapsed. Already-clean text comes back unchanged apart from the trim and
 * the whitespace collapse.
 */
export function htmlToPlainText(value: string | undefined): string {
  if (!value) {
    return "";
  }

  let text = stripHtmlTags(value);

  for (let round = 0; round < maxDecodeRounds; round += 1) {
    const next = stripHtmlTags(decodeHtmlEntities(text));

    if (next === text) {
      break;
    }

    text = next;
  }

  return repairMojibakeApostrophes(text).replace(/\s+/g, " ").trim();
}

/**
 * Link text a feed appends to every summary, one entry per feed that does it.
 * Add a phrase only after seeing it in a real feed — each one is removed from
 * the end of imported text, so a guess could eat the last words of a body.
 */
const trailingFeedBoilerplatePhrases = [
  // InfoQ 中文 (infoq.cn/feed): every `<description>` ends in a right-aligned
  // `<div><a href=…>点击查看原文></a></div>`, and for most items that link is
  // the whole description. 12 of 12 InfoQ candidates on 2026-09-30.
  "点击查看原文"
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The phrase must stand at the very end, after the start of the text or a
 * space, followed by nothing but an arrow mark (`>` `＞` `›` `»`) and
 * whitespace. The block `<div>` InfoQ wraps it in becomes that space, while
 * prose that merely ends in the words (「详情请点击查看原文」) has no gap and is
 * left alone, as is the phrase anywhere mid-text.
 */
const trailingFeedBoilerplatePattern = new RegExp(
  `(?:^|\\s)(?:${trailingFeedBoilerplatePhrases.map(escapeRegExp).join("|")})[\\s>＞›»]*$`
);

function stripTrailingFeedBoilerplate(text: string): string {
  let current = text;

  for (;;) {
    const next = current.replace(trailingFeedBoilerplatePattern, "").trim();

    if (next === current) {
      return current;
    }

    current = next;
  }
}

/**
 * Plain text for an imported summary or body: `htmlToPlainText` plus removal
 * of trailing feed boilerplate. May return an empty string, which callers
 * already treat as "no summary" — so an InfoQ item whose description is only
 * the link is flagged `missing_summary` instead of passing as summarised.
 */
export function cleanFeedText(value: string | undefined): string {
  return stripTrailingFeedBoilerplate(htmlToPlainText(value));
}

/**
 * True when a value has text and all of it is feed boilerplate — the stored
 * `original` of a signal converted from a link-only InfoQ item. Markup-only
 * or empty values are not boilerplate: there is no phrase in them.
 */
export function isFeedBoilerplateOnly(value: string | undefined): boolean {
  const text = htmlToPlainText(value);

  return text.length > 0 && stripTrailingFeedBoilerplate(text) === "";
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Decodes character references in a URL (`&amp;` → `&`). The decoded string
 * is returned as written — not re-serialized through `URL` — so a clean URL is
 * byte-for-byte unchanged; if decoding would not leave a valid http(s) URL,
 * the input is returned trimmed instead.
 */
export function cleanUrl(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  let decoded = trimmed;

  for (let round = 0; round < maxDecodeRounds; round += 1) {
    const next = decodeHtmlEntities(decoded);

    if (next === decoded) {
      break;
    }

    decoded = next;
  }

  if (decoded === trimmed) {
    return trimmed;
  }

  return isHttpUrl(decoded) ? decoded : trimmed;
}
