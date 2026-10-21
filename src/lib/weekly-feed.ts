import {
  escapeXml,
  formatRssDate,
  getSiteBaseUrl,
  renderRssDocument
} from "@/lib/digest-delivery";
import { weeklyReviewFeedPath } from "@/lib/feed-paths";
import { weeklyReviewFeedTitle } from "@/lib/site-metadata";
import {
  getWeeklyReview,
  getWeeklyReviewArchive,
  type WeeklyReviewData,
  type WeeklyReviewSignal
} from "@/lib/weekly-review";
import {
  getPublishedWeeklySummaryPlainText,
  getWeeklySummaries,
  type WeeklySummaryRecord
} from "@/lib/weekly-summary";

/**
 * 本周回顾 RSS（/digest/weekly/feed.xml）：每个已结束、且至少有一条展示
 * 信号的自然周一个 item，最新的周在前；本周留在网页上，周一 0 点后才进
 * feed（2026-10-21 之前当周也在里面：guid 是这一周的地址，内容和 pubDate
 * 却随新信号变，阅读器周一标过已读后就再也看不到这一周后来的信号，seo-11）。
 * 和 /digest/weekly 一样是已发布
 * 信号的纯派生视图——不持久化、不调 AI，只读 getWeeklyReview 已经公开的
 * 字段（标题、周区间、优先级分组），快讯候选与草稿进不来。
 *
 * 唯一的例外是编辑撰写的本周总结（weekly-summary.ts）：只有已发布的那份、
 * 只有文字，放在 item 描述里周区间那一句后面；草稿不会进来。
 */

export const WEEKLY_FEED_ITEM_LIMIT = 12;

const channelTitle = weeklyReviewFeedTitle;

/**
 * Weeks the feed carries: every week that has ended with at least one shown
 * signal, newest first, capped at `limit`. The current week stays on the
 * site until its Sunday is over — an item's guid is the week's address, so a
 * reader shown it on Monday would never see the signals published later that
 * week — and a future-dated signal must not surface a week that has not
 * started.
 */
export function getWeeklyFeedWeeks(
  limit = WEEKLY_FEED_ITEM_LIMIT
): WeeklyReviewData[] {
  const currentWeekKey = getWeeklyReview()?.weekKey;

  if (!currentWeekKey) {
    return [];
  }

  return getWeeklyReviewArchive()
    .filter((entry) => entry.weekKey < currentWeekKey)
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

/** The week's latest signal date; the feed carries ended weeks only, so it never changes. */
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
  baseUrl: string = getSiteBaseUrl(),
  summaries: WeeklySummaryRecord[] = getWeeklySummaries()
): string {
  const feedUrl = `${baseUrl}${weeklyReviewFeedPath}`;
  const homeUrl = `${baseUrl}/digest/weekly`;

  const items = weeks
    .map((week) => {
      const itemUrl = `${baseUrl}/digest/weekly/${week.weekKey}`;
      const summary = getPublishedWeeklySummaryPlainText(
        week.weekKey,
        summaries
      );
      const description = [
        `${week.rangeLabel}（周一–周日）共 ${week.totalCount} 条已发布技术信号。`,
        ...(summary ? [`本周总结：${summary}`] : []),
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

  return renderRssDocument({
    title: channelTitle,
    link: homeUrl,
    description:
      "按自然周（周一–周日）汇总的已发布技术信号，每周一条，列出立即关注与值得跟踪的信号。",
    feedUrl,
    items
  });
}
