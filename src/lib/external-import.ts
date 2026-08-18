import { XMLParser } from "fast-xml-parser";

import { normalizeCandidateId, normalizeCandidateTags } from "@/lib/importers";
import type {
  CandidateNormalizedType,
  ExternalSource,
  ExternalSourceType,
  ImportedCandidate,
  ImportedCandidateSnapshot,
  ImportedCandidateSourceRecord,
  ImportedSourceType,
  SourceLanguage
} from "@/types/content";

interface BaseSourceConfig {
  id: string;
  sourceType: ImportedSourceType;
  sourceName: string;
  sourceUrl: string;
  externalSourceType?: ExternalSourceType;
  language?: SourceLanguage;
  defaultTags?: string[];
  defaultNormalizedType?: CandidateNormalizedType;
  maxItems: number;
}

interface RssFeedSourceConfig extends BaseSourceConfig {
  sourceType: "rss-feed";
  publisherName: string;
}

interface GitHubReleaseSourceConfig extends BaseSourceConfig {
  sourceType: "github-release";
  repository: string;
  publisherName: string;
}

interface OfficialBlogSourceConfig extends BaseSourceConfig {
  sourceType: "official-blog";
  baseUrl: string;
  publisherName: string;
}

const xmlParser = new XMLParser({
  attributeNamePrefix: "",
  ignoreAttributes: false,
  processEntities: false
});

const requestHeaders = {
  "User-Agent": "ai-tech-radar-importer",
  Accept: "application/json, application/xml, text/xml, text/html;q=0.9"
};

const rssFeedSources: RssFeedSourceConfig[] = [
  {
    id: "openai-news-rss",
    sourceType: "rss-feed",
    sourceName: "OpenAI News RSS",
    sourceUrl: "https://openai.com/news/rss.xml",
    publisherName: "OpenAI",
    maxItems: 4
  },
  {
    id: "mcp-github-releases-atom",
    sourceType: "rss-feed",
    sourceName: "GitHub Releases Atom - MCP TypeScript SDK",
    sourceUrl:
      "https://github.com/modelcontextprotocol/typescript-sdk/releases.atom",
    publisherName: "modelcontextprotocol",
    maxItems: 4
  }
];

const gitHubReleaseSources: GitHubReleaseSourceConfig[] = [
  {
    id: "mcp-github-releases-api",
    sourceType: "github-release",
    sourceName: "GitHub Releases API - MCP TypeScript SDK",
    sourceUrl:
      "https://api.github.com/repos/modelcontextprotocol/typescript-sdk/releases",
    repository: "modelcontextprotocol/typescript-sdk",
    publisherName: "modelcontextprotocol",
    maxItems: 4
  }
];

const officialBlogSources: OfficialBlogSourceConfig[] = [
  {
    id: "anthropic-news-pages",
    sourceType: "official-blog",
    sourceName: "Anthropic News",
    sourceUrl: "https://www.anthropic.com/news",
    baseUrl: "https://www.anthropic.com",
    publisherName: "Anthropic",
    maxItems: 2
  }
];

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined ? [] : [value];
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/鈥檚/g, "'s")
    .replace(/鈥檙e/g, "'re")
    .replace(/鈥檝e/g, "'ve")
    .replace(/鈥檒l/g, "'ll")
    .replace(/鈥檛/g, "'t")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2F;/g, "/");
}

function stripHtml(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function getXmlText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record["#text"] === "string") {
      return record["#text"];
    }
  }

  return "";
}

function trimToLength(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function toSourceLanguage(value: string | undefined): SourceLanguage {
  if (!value) {
    return "en";
  }

  return value.toLowerCase().includes("zh") ? "zh" : "en";
}

function toIsoDate(value: string | undefined): string {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const normalizedValue = value.trim();
  const directDate = new Date(normalizedValue);

  if (!Number.isNaN(directDate.valueOf())) {
    return directDate.toISOString().slice(0, 10);
  }

  const monthDateMatch = normalizedValue.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})\b/i
  );

  if (monthDateMatch) {
    const parsedDate = new Date(
      `${monthDateMatch[1]} ${monthDateMatch[2]}, ${monthDateMatch[3]}`
    );

    if (!Number.isNaN(parsedDate.valueOf())) {
      return parsedDate.toISOString().slice(0, 10);
    }
  }

  return normalizedValue.slice(0, 10);
}

function inferNormalizedType(value: string): CandidateNormalizedType {
  const haystack = value.toLowerCase();

  if (/(protocol|spec|sdk transport|mcp)/.test(haystack)) {
    return "protocol";
  }

  if (/(model|opus|sonnet|gpt|llm|language model)/.test(haystack)) {
    return "model";
  }

  if (/(workflow|agent|rollout|eval|orchestration|automation)/.test(haystack)) {
    return "workflow";
  }

  if (/(platform|cloud|workspace|console|hub)/.test(haystack)) {
    return "platform";
  }

  if (/(tool|sdk|api|release|copilot|plugin|cli)/.test(haystack)) {
    return "tool";
  }

  return "unknown";
}

function inferTags(value: string, seededTags: string[] = []): string[] {
  const haystack = value.toLowerCase();
  const tags = [...seededTags];

  if (/(agent|tool use|tooling|orchestration)/.test(haystack)) {
    tags.push("agents");
  }

  if (/(workflow|operations|rollout|automation)/.test(haystack)) {
    tags.push("workflow");
  }

  if (/(evaluation|eval|trace|observability|monitor)/.test(haystack)) {
    tags.push("observability");
  }

  if (/(retrieval|search|grounding|rag)/.test(haystack)) {
    tags.push("retrieval");
  }

  if (/(voice|image|vision|browser|multimodal)/.test(haystack)) {
    tags.push("multimodal");
  }

  if (/(edge|local|on-device)/.test(haystack)) {
    tags.push("on-device");
  }

  if (/(graph|knowledge)/.test(haystack)) {
    tags.push("knowledge-graph");
  }

  return normalizeCandidateTags(tags);
}

function mapExternalSourceTypeToImportedSourceType(
  sourceType: ExternalSourceType
): ImportedSourceType {
  if (sourceType === "github_release") {
    return "github-release";
  }

  if (sourceType === "official_blog") {
    return "official-blog";
  }

  return "rss-feed";
}

function inferGitHubRepository(
  sourceUrl: string,
  fallbackName: string
): string {
  try {
    const parsedUrl = new URL(sourceUrl);
    const parts = parsedUrl.pathname.split("/").filter(Boolean);
    const repoIndex = parts[0] === "repos" ? 1 : 0;
    const owner = parts[repoIndex];
    const repo = parts[repoIndex + 1];

    if (owner && repo) {
      return `${owner}/${repo}`;
    }
  } catch {
    return fallbackName;
  }

  return fallbackName;
}

function toGitHubReleaseApiUrl(sourceUrl: string): string {
  try {
    const parsedUrl = new URL(sourceUrl);

    if (parsedUrl.hostname === "api.github.com") {
      return sourceUrl;
    }

    if (parsedUrl.hostname === "github.com") {
      const [owner, repo] = parsedUrl.pathname.split("/").filter(Boolean);

      if (owner && repo) {
        return `https://api.github.com/repos/${owner}/${repo}/releases`;
      }
    }
  } catch {
    return sourceUrl;
  }

  return sourceUrl;
}

function toConfigFromExternalSource(source: ExternalSource): BaseSourceConfig {
  const sourceType = mapExternalSourceTypeToImportedSourceType(source.type);
  const maxItems = source.maxItems ?? 4;

  if (sourceType === "github-release") {
    return {
      id: source.id,
      sourceType,
      sourceName: source.name,
      sourceUrl: toGitHubReleaseApiUrl(source.url),
      repository: inferGitHubRepository(source.url, source.name),
      publisherName: source.publisherName ?? source.name,
      externalSourceType: source.type,
      language: source.language,
      defaultTags: source.defaultTags,
      defaultNormalizedType: source.defaultNormalizedType,
      maxItems
    } as GitHubReleaseSourceConfig;
  }

  if (sourceType === "official-blog") {
    const baseUrl = (() => {
      try {
        return new URL(source.url).origin;
      } catch {
        return source.url;
      }
    })();

    return {
      id: source.id,
      sourceType,
      sourceName: source.name,
      sourceUrl: source.url,
      baseUrl,
      publisherName: source.publisherName ?? source.name,
      externalSourceType: source.type,
      language: source.language,
      defaultTags: source.defaultTags,
      defaultNormalizedType: source.defaultNormalizedType,
      maxItems
    } as OfficialBlogSourceConfig;
  }

  return {
    id: source.id,
    sourceType,
    sourceName: source.name,
    sourceUrl: source.url,
    publisherName: source.publisherName ?? source.name,
    externalSourceType: source.type,
    language: source.language,
    defaultTags: source.defaultTags,
    defaultNormalizedType: source.defaultNormalizedType,
    maxItems
  } as RssFeedSourceConfig;
}

function applyExternalSourceDefaults(
  candidate: ImportedCandidate,
  config: BaseSourceConfig
): ImportedCandidate {
  return {
    ...candidate,
    sourceId: config.id,
    originalLanguage: config.language ?? candidate.originalLanguage,
    normalizedType:
      config.defaultNormalizedType && config.defaultNormalizedType !== "unknown"
        ? config.defaultNormalizedType
        : candidate.normalizedType,
    tags: normalizeCandidateTags([
      ...(config.defaultTags ?? []),
      ...candidate.tags
    ]),
    rawPayload: {
      ...(candidate.rawPayload && typeof candidate.rawPayload === "object"
        ? (candidate.rawPayload as Record<string, unknown>)
        : {}),
      sourceId: config.id,
      externalSourceType: config.externalSourceType ?? config.sourceType
    }
  };
}

function getAtomEntryLink(entry: Record<string, unknown>): string {
  const links = ensureArray(entry.link as Record<string, unknown> | undefined);
  const preferredLink = links.find((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const record = item as Record<string, unknown>;
    const rel = typeof record.rel === "string" ? record.rel : undefined;

    return rel === undefined || rel === "alternate";
  });

  if (preferredLink && typeof preferredLink === "object") {
    const record = preferredLink as Record<string, unknown>;

    if (record.href) {
      return String(record.href);
    }
  }

  return "";
}

function getRssGuidOrLink(
  item: Record<string, unknown>,
  fallbackValue: string
): string {
  const guid = item.guid;

  if (typeof guid === "string" && guid.trim().length > 0) {
    return guid;
  }

  if (guid && typeof guid === "object") {
    const record = guid as Record<string, unknown>;

    if (
      typeof record["#text"] === "string" &&
      record["#text"].trim().length > 0
    ) {
      return record["#text"];
    }
  }

  return fallbackValue;
}

function buildSourceRecord(
  config: BaseSourceConfig,
  itemCount: number,
  note?: string
): ImportedCandidateSourceRecord {
  return {
    id: config.id,
    sourceType: config.sourceType,
    sourceName: config.sourceName,
    sourceUrl: config.sourceUrl,
    syncStatus: "live",
    itemCount,
    fetchedAt: new Date().toISOString(),
    note
  };
}

/**
 * A response status worth retrying. 5xx and 429 are the server telling us to
 * come back; every other 4xx is a configuration problem (wrong URL, removed
 * feed) that a retry only delays discovering.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export interface ImportFetchSettings {
  attempts: number;
  timeoutMs: number;
  retryDelayMs: number;
}

/**
 * Import fetch policy. Defaults are deliberately small: this runs unattended
 * once a day, so the goal is surviving a single transient handshake failure,
 * not grinding against a source that is genuinely down.
 */
export function resolveImportFetchSettings(
  env: Record<string, string | undefined> = process.env
): ImportFetchSettings {
  const readNumber = (
    raw: string | undefined,
    fallback: number,
    max: number
  ) => {
    const parsed = Number(raw);

    return Number.isFinite(parsed) && parsed > 0
      ? Math.min(Math.floor(parsed), max)
      : fallback;
  };

  return {
    attempts: readNumber(env.IMPORT_FETCH_ATTEMPTS, 3, 5),
    timeoutMs: readNumber(env.IMPORT_FETCH_TIMEOUT_MS, 20000, 120000),
    retryDelayMs: readNumber(env.IMPORT_FETCH_RETRY_DELAY_MS, 800, 30000)
  };
}

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Describes a transport error including the reason nested in `cause`.
 *
 * Why: Node's `fetch` reports every transport failure as the bare string
 * `fetch failed` and puts the actual reason (`ECONNRESET`, `UND_ERR_SOCKET`,
 * `ETIMEDOUT`, a TLS message, …) one level down in `error.cause`. The retry
 * wrapper already carried the last error's `message` into its final message,
 * and that message told us nothing: four GitHub release feeds failed on the
 * 08-17 and 08-18 scheduled runs, in a byte-identical pattern — the first
 * `github.com` feed of the run succeeded and every later one failed, while
 * `openai.com` and `simonwillison.net` requests interleaved between them
 * succeeded — and all eight records read only `fetch failed`.
 *
 * None of it reproduces on demand, so this does not guess at the mechanism. It
 * makes the next occurrence say what actually went wrong.
 */
function describeFetchError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;

  // A cause chain is normally one or two deep; the cap is only a cycle guard.
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const code = (current as { code?: unknown }).code;
    const label =
      typeof code === "string" && code && !current.message.includes(code)
        ? `${current.message} (${code})`
        : current.message;

    if (label && !parts.includes(label)) {
      parts.push(label);
    }

    current = current.cause;
  }

  if (parts.length === 0) {
    return String(error);
  }

  return parts.join(" ← ");
}

type FetchAttemptResult =
  | { kind: "ok"; response: Response }
  /** A configuration problem: retrying only delays finding out. */
  | { kind: "fatal"; error: Error }
  /** A transport failure, timeout, 429, or 5xx. */
  | { kind: "retryable"; error: Error };

async function attemptFetch(
  url: string,
  timeoutMs: number,
  fetchImpl: FetchImpl
): Promise<FetchAttemptResult> {
  try {
    const response = await fetchImpl(url, {
      headers: requestHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (response.ok) {
      return { kind: "ok", response };
    }

    const error = new Error(`请求失败（HTTP ${response.status}）：${url}`);

    return isRetryableStatus(response.status)
      ? { kind: "retryable", error }
      : { kind: "fatal", error };
  } catch (error) {
    return {
      kind: "retryable",
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

/**
 * Fetches a source URL, retrying transport failures and retryable statuses.
 *
 * Why this exists: the importer used to call `fetch` bare, so one transient
 * TLS handshake failure lost that source's entire daily import until the next
 * scheduled run — on 2026-07-28 that dropped three GitHub release feeds, one
 * of which carried a stable release. Each attempt also carries an explicit
 * timeout so a hung connection fails fast instead of stalling the run.
 */
export async function fetchWithRetry(
  url: string,
  options: { settings?: ImportFetchSettings; fetchImpl?: FetchImpl } = {}
): Promise<Response> {
  const settings = options.settings ?? resolveImportFetchSettings();
  const fetchImpl = options.fetchImpl ?? fetch;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= settings.attempts; attempt += 1) {
    const result = await attemptFetch(url, settings.timeoutMs, fetchImpl);

    if (result.kind === "ok") {
      return result.response;
    }

    if (result.kind === "fatal") {
      throw result.error;
    }

    lastError = result.error;

    if (attempt < settings.attempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, settings.retryDelayMs * attempt)
      );
    }
  }

  throw new Error(
    `请求失败（重试 ${settings.attempts} 次后仍失败）：${
      lastError ? describeFetchError(lastError) : url
    }`
  );
}

async function fetchText(url: string): Promise<string> {
  const response = await fetchWithRetry(url);

  return response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetchWithRetry(url);

  return response.json() as Promise<T>;
}

async function fetchRssFeedCandidates(
  config: RssFeedSourceConfig
): Promise<ImportedCandidate[]> {
  const xml = await fetchText(config.sourceUrl);
  const parsed = xmlParser.parse(xml);

  if (parsed.rss?.channel?.item) {
    const channel = parsed.rss.channel;
    const items = ensureArray<Record<string, unknown>>(channel.item).slice(
      0,
      config.maxItems
    );

    return items.map((item) => {
      const title = stripHtml(String(item.title ?? ""));
      const summary = stripHtml(
        getXmlText(item.description ?? item.summary ?? item["content:encoded"])
      );
      const content = stripHtml(
        getXmlText(item["content:encoded"] ?? item.description ?? summary)
      );
      const categories = ensureArray(item.category)
        .map((category) => stripHtml(String(category ?? "")))
        .filter(Boolean);
      const sourceUrl = String(item.link ?? item.guid ?? config.sourceUrl);
      const candidateSeed = getRssGuidOrLink(
        item,
        sourceUrl || `${title}-${config.sourceName}`
      );
      const combinedText = [title, summary, content, config.sourceName].join(
        " "
      );

      return {
        id: `candidate-rss-${normalizeCandidateId(candidateSeed)}`,
        sourceType: "rss-feed",
        sourceName: config.sourceName,
        sourceUrl,
        originalTitle: title,
        originalSummary: trimToLength(summary, 260),
        originalContent: trimToLength(content || summary, 1600),
        originalLanguage: toSourceLanguage(
          String(item.language ?? channel.language ?? "en")
        ),
        publishDate: toIsoDate(String(item.pubDate ?? item.isoDate ?? "")),
        publisherName: stripHtml(
          String(item["dc:creator"] ?? item.author ?? config.publisherName)
        ),
        normalizedType: inferNormalizedType(combinedText),
        tags: inferTags(combinedText, categories),
        importStatus: "new",
        relatedCandidateIds: [],
        rawPayload: {
          sourceId: config.id,
          feedTitle: stripHtml(String(channel.title ?? config.sourceName)),
          feedUrl: config.sourceUrl,
          item
        }
      };
    });
  }

  if (parsed.feed?.entry) {
    const feed = parsed.feed;
    const entries = ensureArray<Record<string, unknown>>(feed.entry).slice(
      0,
      config.maxItems
    );

    return entries.map((entry) => {
      const sourceUrl = getAtomEntryLink(entry) || config.sourceUrl;
      const content = stripHtml(
        getXmlText(entry.content ?? entry.summary ?? entry.title)
      );
      const summary = stripHtml(getXmlText(entry.summary ?? content));
      const title = stripHtml(String(entry.title ?? ""));
      const categories = ensureArray(entry.category)
        .map((category) => {
          if (typeof category === "object" && category) {
            const record = category as Record<string, unknown>;

            return stripHtml(String(record.term ?? record.label ?? ""));
          }

          return stripHtml(String(category ?? ""));
        })
        .filter(Boolean);
      const publisher =
        typeof entry.author === "object"
          ? stripHtml(
              String((entry.author as Record<string, unknown>).name ?? "")
            )
          : config.publisherName;
      const combinedText = [title, summary, content, config.sourceName].join(
        " "
      );

      return {
        id: `candidate-rss-${normalizeCandidateId(sourceUrl || title)}`,
        sourceType: "rss-feed",
        sourceName: config.sourceName,
        sourceUrl,
        originalTitle: title,
        originalSummary: trimToLength(summary, 260),
        originalContent: trimToLength(content || summary, 1600),
        originalLanguage: "en",
        publishDate: toIsoDate(String(entry.updated ?? entry.published ?? "")),
        publisherName: publisher || config.publisherName,
        normalizedType: inferNormalizedType(combinedText),
        tags: inferTags(combinedText, categories),
        importStatus: "new",
        relatedCandidateIds: [],
        rawPayload: {
          sourceId: config.id,
          feedTitle: stripHtml(String(feed.title ?? config.sourceName)),
          feedUrl: config.sourceUrl,
          entry
        }
      };
    });
  }

  throw new Error(`不支持的订阅源格式：${config.sourceUrl}`);
}

interface GitHubReleaseApiRecord {
  id: number;
  html_url: string;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  author?: {
    login?: string;
  };
}

async function fetchGitHubReleaseCandidates(
  config: GitHubReleaseSourceConfig
): Promise<ImportedCandidate[]> {
  const releases = await fetchJson<GitHubReleaseApiRecord[]>(config.sourceUrl);

  return releases
    .filter((release) => !release.draft)
    .slice(0, config.maxItems)
    .map((release) => {
      const title = stripHtml(
        `${config.repository} ${release.name || release.tag_name}`
      );
      const content = stripHtml(release.body ?? "");
      const summary = trimToLength(content, 260);
      const seededTags = [
        release.prerelease ? "pre-release" : "release",
        "github"
      ];
      const combinedText = [title, content, config.repository].join(" ");

      return {
        id: `candidate-github-${normalizeCandidateId(
          `${config.repository}-${release.tag_name}`
        )}`,
        sourceType: "github-release",
        sourceName: config.sourceName,
        sourceUrl: release.html_url,
        originalTitle: title,
        originalSummary: summary,
        originalContent: trimToLength(content || summary, 1800),
        originalLanguage: "en",
        publishDate: toIsoDate(release.published_at),
        publisherName: release.author?.login || config.publisherName,
        normalizedType: inferNormalizedType(combinedText),
        tags: inferTags(combinedText, seededTags),
        importStatus: "new",
        relatedCandidateIds: [],
        rawPayload: {
          sourceId: config.id,
          repository: config.repository,
          release
        }
      };
    });
}

interface ListingPreviewItem {
  href: string;
  date?: string;
  excerpt?: string;
}

function extractAnthropicListingItems(
  html: string,
  maxItems: number
): ListingPreviewItem[] {
  const hrefs = [...html.matchAll(/href="(\/news\/[^"]+)"/g)].map(
    (match) => match[1]
  );
  const uniqueHrefs = [...new Set(hrefs)].slice(0, maxItems);

  return uniqueHrefs.map((href) => {
    const index = html.indexOf(`href="${href}"`);
    const window = html.slice(index, index + 1400);

    return {
      href,
      date: window
        .match(/<time[^>]*>(.*?)<\/time>/i)?.[1]
        ?.replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
      excerpt: window
        .match(/<p[^>]*>(.*?)<\/p>/i)?.[1]
        ?.replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    };
  });
}

function extractReadableParagraphs(html: string): string[] {
  return [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) =>
      decodeHtmlEntities(
        match[1]
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      )
    )
    .filter((paragraph) => {
      if (paragraph.length < 60) {
        return false;
      }

      return !/(Research Economic Futures|Try Claude|01 \/|Learn News)/i.test(
        paragraph
      );
    });
}

async function fetchOfficialBlogCandidates(
  config: OfficialBlogSourceConfig
): Promise<ImportedCandidate[]> {
  const listingHtml = await fetchText(config.sourceUrl);
  const previews = extractAnthropicListingItems(listingHtml, config.maxItems);

  const results: ImportedCandidate[] = [];

  for (const preview of previews) {
    const articleUrl = new URL(preview.href, config.baseUrl).toString();
    const articleHtml = await fetchText(articleUrl);
    const title =
      decodeHtmlEntities(
        articleHtml.match(
          /<meta property="og:title" content="([^"]+)"/i
        )?.[1] ?? ""
      ) || stripHtml(articleHtml.match(/<title>(.*?)<\/title>/i)?.[1] ?? "");
    const paragraphs = extractReadableParagraphs(articleHtml);
    const summary = trimToLength(
      preview.excerpt || paragraphs[0] || "未能从来源页面提取摘要。",
      260
    );
    const content = trimToLength(
      paragraphs.slice(0, 4).join("\n\n") || summary,
      2200
    );
    const dateMatch =
      articleHtml.match(
        /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}\b/
      )?.[0] ?? preview.date;
    const combinedText = [title, summary, content, config.sourceName].join(" ");

    results.push({
      id: `candidate-blog-${normalizeCandidateId(preview.href)}`,
      sourceType: "official-blog",
      sourceName: config.sourceName,
      sourceUrl: articleUrl,
      originalTitle: title,
      originalSummary: summary,
      originalContent: content,
      originalLanguage: "en",
      publishDate: toIsoDate(dateMatch),
      publisherName: config.publisherName,
      normalizedType: inferNormalizedType(combinedText),
      tags: inferTags(combinedText, ["official-blog"]),
      importStatus: "new",
      relatedCandidateIds: [],
      rawPayload: {
        sourceId: config.id,
        listingUrl: config.sourceUrl,
        listingPreview: preview,
        extractedParagraphs: paragraphs.slice(0, 6)
      }
    });
  }

  return results;
}

export function getSupportedExternalSourceTypes(): ExternalSourceType[] {
  return ["rss", "atom", "github_release", "official_blog"];
}

export function getExternalSourceSummaries(): Array<{
  id: string;
  sourceType: ImportedSourceType;
  sourceName: string;
  sourceUrl: string;
}> {
  return [
    ...rssFeedSources,
    ...gitHubReleaseSources,
    ...officialBlogSources
  ].map((source) => ({
    id: source.id,
    sourceType: source.sourceType,
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl
  }));
}

async function importCandidatesForConfig(
  config: BaseSourceConfig
): Promise<ImportedCandidate[]> {
  const imported =
    config.sourceType === "github-release"
      ? await fetchGitHubReleaseCandidates(config as GitHubReleaseSourceConfig)
      : config.sourceType === "official-blog"
        ? await fetchOfficialBlogCandidates(config as OfficialBlogSourceConfig)
        : await fetchRssFeedCandidates(config as RssFeedSourceConfig);

  return imported.map((candidate) =>
    applyExternalSourceDefaults(candidate, config)
  );
}

export async function importCandidatesForExternalSource(
  source: ExternalSource
): Promise<ImportedCandidate[]> {
  return importCandidatesForConfig(toConfigFromExternalSource(source));
}

export function buildImportedCandidateSourceRecord(
  source: ExternalSource,
  itemCount: number,
  syncStatus: ImportedCandidateSourceRecord["syncStatus"],
  note?: string
): ImportedCandidateSourceRecord {
  return {
    id: source.id,
    sourceType: mapExternalSourceTypeToImportedSourceType(source.type),
    sourceName: source.name,
    sourceUrl: source.url,
    syncStatus,
    itemCount,
    fetchedAt: new Date().toISOString(),
    note
  };
}

export async function syncExternalImportedCandidates(
  sources?: ExternalSource[]
): Promise<ImportedCandidateSnapshot> {
  const sourceRecords: ImportedCandidateSourceRecord[] = [];
  const candidates: ImportedCandidate[] = [];

  if (sources) {
    for (const source of sources.filter((item) => item.enabled)) {
      const imported = await importCandidatesForExternalSource(source);

      sourceRecords.push(
        buildImportedCandidateSourceRecord(source, imported.length, "live")
      );
      candidates.push(...imported);
    }

    return {
      syncedAt: new Date().toISOString(),
      sources: sourceRecords,
      candidates: candidates.sort((left, right) =>
        right.publishDate.localeCompare(left.publishDate)
      )
    };
  }

  for (const source of rssFeedSources) {
    const imported = await importCandidatesForConfig(source);
    sourceRecords.push(buildSourceRecord(source, imported.length));
    candidates.push(...imported);
  }

  for (const source of gitHubReleaseSources) {
    const imported = await importCandidatesForConfig(source);
    sourceRecords.push(buildSourceRecord(source, imported.length));
    candidates.push(...imported);
  }

  for (const source of officialBlogSources) {
    const imported = await importCandidatesForConfig(source);
    sourceRecords.push(buildSourceRecord(source, imported.length));
    candidates.push(...imported);
  }

  return {
    syncedAt: new Date().toISOString(),
    sources: sourceRecords,
    candidates: candidates.sort((left, right) =>
      right.publishDate.localeCompare(left.publishDate)
    )
  };
}
