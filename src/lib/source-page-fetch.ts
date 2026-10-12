import { extractArticleText } from "@/lib/candidate-article";

/**
 * The text of a candidate's primary source, for 「AI 起草」.
 *
 * Triage needs the article's opening (`candidate-article.ts`, 1,500
 * characters); a draft needs the article. Same extraction, a larger cap, and
 * one special case: a GitHub release page is a JavaScript shell around the
 * notes, so a `github.com/<owner>/<repo>/releases/tag/<tag>` URL is read from
 * the REST API instead, which returns the notes as Markdown.
 *
 * Never throws. A failure says why, and the caller falls back to the
 * candidate's own title, summary and body.
 */

export const SOURCE_TEXT_MAX_CHARS = 12000;

/** Bytes of HTML read before extraction; a regex over a 5 MB page is slow
 *  and the article is never that far in. */
const MAX_RESPONSE_CHARS = 1_500_000;

const DEFAULT_TIMEOUT_MS = 15000;

export type SourceTextOrigin = "page" | "github_release";

export type SourceText =
  | { ok: true; text: string; origin: SourceTextOrigin; url: string }
  | { ok: false; error: string };

const GITHUB_RELEASE_URL =
  /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/tag\/([^/?#]+)/i;

/** The REST endpoint for a GitHub release page, or undefined. */
export function getGitHubReleaseApiUrl(url: string): string | undefined {
  const match = GITHUB_RELEASE_URL.exec(url.trim());

  if (!match) {
    return undefined;
  }

  const [, owner, repo, tag] = match;

  return `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;
}

function cap(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return "请求超时";
    }

    return error.message;
  }

  return String(error);
}

async function fetchGitHubRelease(
  apiUrl: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  maxChars: number
): Promise<SourceText> {
  const response = await fetchImpl(apiUrl, {
    headers: {
      "user-agent": "AITechRadarDraft/1.0 (+https://aizyradar.cn)",
      accept: "application/vnd.github+json"
    },
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    return { ok: false, error: `GitHub API HTTP ${response.status}` };
  }

  const release = (await response.json()) as {
    name?: string;
    tag_name?: string;
    body?: string;
  };
  const body = (release.body ?? "").trim();

  if (body.length < 20) {
    return { ok: false, error: "release 说明为空" };
  }

  const heading = [release.name, release.tag_name].filter(Boolean).join(" / ");

  return {
    ok: true,
    origin: "github_release",
    url: apiUrl,
    text: cap(`${heading}\n\n${body}`, maxChars)
  };
}

async function fetchPage(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  maxChars: number
): Promise<SourceText> {
  const response = await fetchImpl(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; AITechRadarDraft/1.0; +https://aizyradar.cn)",
      accept: "text/html,application/xhtml+xml"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}` };
  }

  const type = response.headers.get("content-type") ?? "";

  if (!/html|xml/i.test(type)) {
    return { ok: false, error: `不是网页（${type || "未知类型"}）` };
  }

  const html = (await response.text()).slice(0, MAX_RESPONSE_CHARS);
  const text = extractArticleText(html, maxChars);

  // The same floor as triage: under ~80 characters is a shell page (a
  // JavaScript app, a consent wall), not an article.
  return text.length >= 80
    ? { ok: true, origin: "page", url, text }
    : { ok: false, error: "页面没有可读正文" };
}

export async function fetchSourceText(
  url: string,
  options: {
    timeoutMs?: number;
    maxChars?: number;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<SourceText> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxChars = options.maxChars ?? SOURCE_TEXT_MAX_CHARS;

  try {
    new URL(url);
  } catch {
    return { ok: false, error: "来源链接无效" };
  }

  try {
    const apiUrl = getGitHubReleaseApiUrl(url);

    return apiUrl
      ? await fetchGitHubRelease(apiUrl, fetchImpl, timeoutMs, maxChars)
      : await fetchPage(url, fetchImpl, timeoutMs, maxChars);
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}
