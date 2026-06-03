import type {
  ImportedCandidate,
  ImportedSourceType
} from "@/types/content";
import type {
  MockGithubReleasePayload,
  MockOfficialBlogPayload,
  MockRssFeedPayload
} from "@/data/import-source-payloads";
import {
  githubReleasePayloads,
  officialBlogPayloads,
  rssFeedPayloads
} from "@/data/import-source-payloads";

interface CandidateImporter<TPayload> {
  sourceType: ImportedSourceType;
  importFromPayload: (payload: TPayload) => ImportedCandidate[];
}

export function normalizeCandidateId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeCandidateTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.toLowerCase())
    )
  );
}

const rssImporter: CandidateImporter<MockRssFeedPayload> = {
  sourceType: "rss-feed",
  importFromPayload(payload) {
    return payload.entries.map((entry) => ({
      id: `candidate-rss-${normalizeCandidateId(entry.guid)}`,
      sourceId: `fallback-rss-${normalizeCandidateId(payload.feedTitle)}`,
      sourceType: "rss-feed",
      sourceName: payload.feedTitle,
      sourceUrl: entry.link,
      originalTitle: entry.title,
      originalSummary: entry.summary,
      originalContent: entry.content,
      originalLanguage: entry.language,
      publishDate: entry.isoDate,
      publisherName: entry.publisherName,
      normalizedType: entry.normalizedTypeHint,
      tags: normalizeCandidateTags(entry.categories),
      importStatus: entry.importStatus,
      relatedCandidateIds: [],
      rawPayload: {
        sourceId: `fallback-rss-${normalizeCandidateId(payload.feedTitle)}`,
        feedTitle: payload.feedTitle,
        feedUrl: payload.feedUrl,
        entry
      }
    }));
  }
};

const githubReleaseImporter: CandidateImporter<MockGithubReleasePayload> = {
  sourceType: "github-release",
  importFromPayload(payload) {
    return payload.releases.map((release) => ({
      id: `candidate-github-${normalizeCandidateId(
        `${payload.repository}-${release.tagName}`
      )}`,
      sourceId: `fallback-github-${normalizeCandidateId(payload.repository)}`,
      sourceType: "github-release",
      sourceName: payload.repository,
      sourceUrl: release.htmlUrl,
      originalTitle: `${payload.repository} ${release.name}`,
      originalSummary: release.body,
      originalContent: release.body,
      originalLanguage: release.language,
      publishDate: release.publishedAt,
      publisherName: release.authorLogin,
      normalizedType: release.normalizedTypeHint,
      tags: normalizeCandidateTags(release.topics),
      importStatus: release.importStatus,
      relatedCandidateIds: [],
      rawPayload: {
        sourceId: `fallback-github-${normalizeCandidateId(payload.repository)}`,
        repository: payload.repository,
        repositoryUrl: payload.repositoryUrl,
        release
      }
    }));
  }
};

const officialBlogImporter: CandidateImporter<MockOfficialBlogPayload> = {
  sourceType: "official-blog",
  importFromPayload(payload) {
    return payload.posts.map((post) => ({
      id: `candidate-blog-${normalizeCandidateId(post.id)}`,
      sourceId: `fallback-blog-${normalizeCandidateId(payload.siteName)}`,
      sourceType: "official-blog",
      sourceName: payload.siteName,
      sourceUrl: post.url,
      originalTitle: post.title,
      originalSummary: post.excerpt,
      originalContent: post.content,
      originalLanguage: post.language,
      publishDate: post.publishedAt,
      publisherName: post.authorName,
      normalizedType: post.normalizedTypeHint,
      tags: normalizeCandidateTags(post.tags),
      importStatus: post.importStatus,
      relatedCandidateIds: [],
      rawPayload: {
        sourceId: `fallback-blog-${normalizeCandidateId(payload.siteName)}`,
        siteName: payload.siteName,
        siteUrl: payload.siteUrl,
        post
      }
    }));
  }
};

export function buildFallbackImportedCandidates(): ImportedCandidate[] {
  return [
    ...rssFeedPayloads.flatMap((payload) => rssImporter.importFromPayload(payload)),
    ...githubReleasePayloads.flatMap((payload) =>
      githubReleaseImporter.importFromPayload(payload)
    ),
    ...officialBlogPayloads.flatMap((payload) =>
      officialBlogImporter.importFromPayload(payload)
    )
  ].sort((left, right) => right.publishDate.localeCompare(left.publishDate));
}

export function buildImportedCandidates(): ImportedCandidate[] {
  return buildFallbackImportedCandidates();
}
