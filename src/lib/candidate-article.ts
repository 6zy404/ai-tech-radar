/**
 * The readable text of a candidate's primary source, for triage prompt v2.
 *
 * Why: the v1 eval found that the model misses what editors publish mostly
 * because it sees only the feed — on the first live round five of the six
 * missed publishes were held with 「摘要太短，无法核对」, and every one was
 * decided on the article (eval/triage/README.md). Giving the model the
 * article's opening is the fix the reasons pointed at.
 *
 * Deliberately small: no readability library, no JavaScript rendering. It
 * takes <article>, else <main>, else <body>, drops the obvious chrome, and
 * keeps the first `maxChars` characters. A page that needs JavaScript or
 * refuses the request simply yields no excerpt, and the prompt says so.
 */

export const ARTICLE_EXCERPT_CHARS = 1500;

const entities: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…"
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16))
    )
    .replace(/&[a-z]+;|&#39;/gi, (entity) => entities[entity] ?? entity);
}

function innerOf(html: string, tag: string): string | undefined {
  const match = html.match(
    new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i")
  );

  return match?.[1];
}

/** Pure: HTML in, the page's readable text out (whitespace collapsed). */
export function extractArticleText(
  html: string,
  maxChars = ARTICLE_EXCERPT_CHARS
): string {
  const cleaned = html.replace(
    /<(script|style|noscript|svg|nav|header|footer|aside|form|template)\b[\s\S]*?<\/\1>/gi,
    " "
  );
  const region =
    innerOf(cleaned, "article") ??
    innerOf(cleaned, "main") ??
    innerOf(cleaned, "body") ??
    cleaned;
  const text = decodeEntities(
    region
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();

  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

export type ArticleExcerpt =
  { ok: true; text: string } | { ok: false; error: string };

const requestHeaders = {
  "user-agent":
    "Mozilla/5.0 (compatible; AITechRadarTriage/1.0; +https://aizyradar.cn)",
  accept: "text/html,application/xhtml+xml"
};

export async function fetchArticleExcerpt(
  url: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<ArticleExcerpt> {
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(url, {
      headers: requestHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(options.timeoutMs ?? 15000)
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const type = response.headers.get("content-type") ?? "";

    if (!/html|xml/i.test(type)) {
      return { ok: false, error: `不是网页（${type || "未知类型"}）` };
    }

    const text = extractArticleText(await response.text());

    // Under ~80 characters is a shell page (a JavaScript app, a consent
    // wall), not an article; treat it as no excerpt rather than feed it in.
    return text.length >= 80
      ? { ok: true, text }
      : { ok: false, error: "页面没有可读正文" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
