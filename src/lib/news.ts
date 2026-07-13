import {
  getDuplicateGroups,
  getImportedCandidates
} from "@/lib/candidate-workflow";
import { getAllTags, getAllTechnologies } from "@/lib/content";
import { getTodayDateString } from "@/lib/digest-store";
import type { DuplicateGroup, ImportedCandidate } from "@/types/content";

/**
 * 公开快讯层（自动聚合，未经编辑精选）。
 *
 * 这是导入候选进入公开页面的唯一映射点：只允许标题、摘要、来源名称、
 * 来源链接、发布日期和话题标签离开服务端。rawPayload、importStatus、
 * normalizedType、重复组内部字段、候选 ID 等内部字段一律不进入公开形状。
 */
export interface PublicNewsItem {
  key: string;
  title: string;
  summary?: string;
  sourceName: string;
  sourceUrl: string;
  publishDate: string;
  tags: string[];
  publishedTechnology?: {
    slug: string;
    title: string;
  };
}

export interface PublicNewsDay {
  date: string;
  items: PublicNewsItem[];
}

export const newsWindowDays = 7;
export const newsDisclaimer = "自动聚合内容，未经编辑精选，以来源原文为准。";

const maxNewsItems = 200;
const maxSummaryLength = 220;
const fallbackTag = "fallback";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function getWindowStartDate(now = new Date()): string {
  const start = new Date(now.getTime());
  start.setDate(start.getDate() - (newsWindowDays - 1));

  return getTodayDateString(start);
}

function getCandidateNewsDate(
  candidate: ImportedCandidate
): string | undefined {
  if (datePattern.test(candidate.publishDate)) {
    return candidate.publishDate;
  }

  if (candidate.importedAt) {
    const importedAt = new Date(candidate.importedAt);

    if (!Number.isNaN(importedAt.getTime())) {
      return getTodayDateString(importedAt);
    }
  }

  return undefined;
}

function isFallbackCandidate(candidate: ImportedCandidate): boolean {
  return candidate.tags.includes(fallbackTag);
}

function buildDuplicateExclusionSet(groups: DuplicateGroup[]): Set<string> {
  const excluded = new Set<string>();

  for (const group of groups) {
    if (group.status === "ignored") {
      continue;
    }

    for (const candidateId of group.candidateIds) {
      if (candidateId !== group.primaryCandidateId) {
        excluded.add(candidateId);
      }
    }
  }

  return excluded;
}

function truncateSummary(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length <= maxSummaryLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxSummaryLength).trimEnd()}…`;
}

function getPublicTagNames(tags: string[]): string[] {
  const allTags = getAllTags();

  return tags
    .filter((tag) => tag !== fallbackTag)
    .map((tag) => allTags.find((topicTag) => topicTag.id === tag)?.name ?? tag)
    .slice(0, 4);
}

function toPublicNewsItem(
  candidate: ImportedCandidate,
  newsDate: string
): PublicNewsItem {
  const publishedTechnology = candidate.convertedTechnologyId
    ? getAllTechnologies().find(
        (technology) => technology.id === candidate.convertedTechnologyId
      )
    : undefined;

  return {
    key: `${newsDate}::${candidate.sourceUrl}`,
    title: candidate.originalTitle,
    summary: truncateSummary(candidate.originalSummary),
    sourceName: candidate.sourceName,
    sourceUrl: candidate.sourceUrl,
    publishDate: newsDate,
    tags: getPublicTagNames(candidate.tags),
    publishedTechnology: publishedTechnology
      ? {
          slug: publishedTechnology.slug,
          title: publishedTechnology.title.zh?.trim()
            ? publishedTechnology.title.zh
            : publishedTechnology.title.original
        }
      : undefined
  };
}

export function getPublicNewsItems(now = new Date()): PublicNewsItem[] {
  const windowStart = getWindowStartDate(now);
  const today = getTodayDateString(now);
  const excludedDuplicateIds = buildDuplicateExclusionSet(getDuplicateGroups());
  const items: { item: PublicNewsItem; importedAt: string }[] = [];

  for (const candidate of getImportedCandidates()) {
    if (candidate.importStatus === "rejected") {
      continue;
    }

    if (isFallbackCandidate(candidate)) {
      continue;
    }

    if (excludedDuplicateIds.has(candidate.id)) {
      continue;
    }

    const newsDate = getCandidateNewsDate(candidate);

    if (!newsDate || newsDate < windowStart || newsDate > today) {
      continue;
    }

    items.push({
      item: toPublicNewsItem(candidate, newsDate),
      importedAt: candidate.importedAt ?? ""
    });
  }

  return items
    .sort(
      (left, right) =>
        right.item.publishDate.localeCompare(left.item.publishDate) ||
        right.importedAt.localeCompare(left.importedAt) ||
        left.item.title.localeCompare(right.item.title)
    )
    .slice(0, maxNewsItems)
    .map((entry) => entry.item);
}

export function getPublicNewsDays(now = new Date()): PublicNewsDay[] {
  const days = new Map<string, PublicNewsItem[]>();

  for (const item of getPublicNewsItems(now)) {
    const dayItems = days.get(item.publishDate) ?? [];

    dayItems.push(item);
    days.set(item.publishDate, dayItems);
  }

  return [...days.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([date, items]) => ({ date, items }));
}

export function getLatestPublicNewsItems(
  limit: number,
  now = new Date()
): PublicNewsItem[] {
  return getPublicNewsItems(now).slice(0, Math.max(limit, 0));
}
