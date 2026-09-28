import {
  escapeXml,
  formatRssDate,
  getSiteBaseUrl
} from "@/lib/digest-delivery";
import { weeklyReviewFeedPath } from "@/lib/feed-paths";
import {
  getWeeklyReview,
  getWeeklyReviewArchive,
  type WeeklyReviewData,
  type WeeklyReviewSignal
} from "@/lib/weekly-review";

/**
 * 本周回顾 RSS（/digest/weekly/feed.xml）：每个已结束或当前、且至少有一条
 * 展示信号的自然周一个 item，最新的周在前。和 /digest/weekly 一样是已发布
 * 信号的纯派生视图——不持久化、不调 AI，只读 getWeeklyReview 已经公开的
 * 字段（标题、周区间、优先级分组），快讯候选与草稿进不来。
 */

export const WEEKLY_FEED_ITEM_LIMIT = 12;

const channelTitle = "AI Tech Radar 本周回顾";

/**
 * Weeks the feed carries: every week with at least one shown signal, up to
 * and including the current week (a future-dated signal must not surface a
 * week that has not started), newest first, capped at `limit`.
 */
export function getWeeklyFeedWeeks(
  limit = WEEKLY_FEED_ITEM_LIMIT
): WeeklyReviewData[] {
  const currentWeekKey = getWeeklyReview()?.weekKey;

  if (!currentWeekKey) {
    return [];
  }

  return getWeeklyReviewArchive()
    .filter((entry) => entry.weekKey <= currentWeekKey)
    .slice(0, limit)
    .map((entry) => getWeeklyReview(entry.weekKey))
    .filter(
      (week): week is WeeklyReviewData =>
        week !== undefined && week.totalCount > 0
    );
}

function signalsAt(
  week: WeeklyReviewData,
  level: WeeklyReviewSignal["level"]
): WeeklyReviewSignal[] {
  return week.groups.find((group) => group.level === level)?.signals ?? [];
}

function buildSignalListText(
  label: string,
  signals: WeeklyReviewSignal[]
): string {
  return signals.length === 0
    ? `${label}：无`
    : `${label}：${signals.map((signal) => signal.title).join("；")}`;
}

/** The week's latest signal date: stable once a week has ended. */
function getWeekLastSignalDate(week: WeeklyReviewData): string {
  return week.groups
    .flatMap((group) => group.signals)
    .reduce(
      (latest, signal) =>
        signal.publishDate > latest ? signal.publishDate : latest,
      week.weekStart
    );
}

export function getWeeklyFeedItemTitle(week: WeeklyReviewData): string {
  return `本周回顾 · ${week.weekKey} 这一周`;
}

export function renderWeeklyReviewRssXml(
  weeks: WeeklyReviewData[] = getWeeklyFeedWeeks(),
  baseUrl: string = getSiteBaseUrl()
): string {
  const feedUrl = `${baseUrl}${weeklyReviewFeedPath}`;
  const homeUrl = `${baseUrl}/digest/weekly`;

  const items = weeks
    .map((week) => {
      const itemUrl = `${baseUrl}/digest/weekly/${week.weekKey}`;
      const description = [
        `${week.rangeLabel}（周一–周日）共 ${week.totalCount} 条已发布技术信号。`,
        buildSignalListText("立即关注", signalsAt(week, "high_priority")),
        buildSignalListText("值得跟踪", signalsAt(week, "watch"))
      ].join("\n\n");

      return [
        "    <item>",
        `      <title>${escapeXml(getWeeklyFeedItemTitle(week))}</title>`,
        `      <link>${escapeXml(itemUrl)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(itemUrl)}</guid>`,
        `      <pubDate>${escapeXml(formatRssDate(undefined, getWeekLastSignalDate(week)))}</pubDate>`,
        `      <description>${escapeXml(description)}</description>`,
        `      <source url="${escapeXml(feedUrl)}">${escapeXml(channelTitle)}</source>`,
        "    </item>"
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(channelTitle)}</title>`,
    `    <link>${escapeXml(homeUrl)}</link>`,
    `    <description>${escapeXml(
      "按自然周（周一–周日）汇总的已发布技术信号，每周一条，列出立即关注与值得跟踪的信号。"
    )}</description>`,
    `    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>`,
    ...(items ? [items] : []),
    "  </channel>",
    "</rss>"
  ].join("\n");
}
