import type { Locale } from "@/lib/i18n/locale";

/* Interface text of /digest/weekly and /digest/weekly/[week]. Week ranges
   come from week-range.ts. See copy/shell.ts for the pattern. */

const zh = {
  title: "本周回顾",
  description: "按自然周汇总的已发布技术信号。",
  sectionLabel: "周回顾",
  unavailableTitle: "暂时无法生成本周回顾。",
  unavailableBody: "技术信号发布后会在这里按周汇总。",
  readDigest: "阅读技术简报",
  backToThisWeek: "回到本周回顾",
  notFoundTitle: "没有这一页",
  weekPageTitle: (range: string) => `${range} · 本周回顾`,
  weekShellTitle: (range: string) => `周回顾 · ${range}`,
  weekDescription: (
    total: number,
    high: number,
    watch: number,
    topics: number
  ) =>
    `这一周有 ${total} 条已发布技术信号：立即关注 ${high} 条，值得跟踪 ${watch} 条，覆盖 ${topics} 个话题。`,
  pageDescription: (range: string, hasSummary: boolean) =>
    hasSummary
      ? `${range}（周一–周日）已发布的技术信号，按优先级汇总。信号列表由已发布信号自动派生，本周总结由编辑撰写。`
      : `${range}（周一–周日）已发布的技术信号，按优先级汇总。纯派生自已发布信号，无编辑撰写、无 AI。`,
  stats: {
    signals: "本周信号",
    high: "立即关注",
    watch: "值得跟踪",
    topics: "覆盖主题"
  },
  summaryHeading: "本周总结",
  groupLedes: {
    high_priority: "本周多项信号显示值得尽早评估的内容。",
    watch: "本周值得持续留意、等待更多验证的变化。"
  },
  groupCount: (n: number) => `${n} 条`,
  sourcePrefix: "· ",
  emptyTitle: "本周还没有已发布的技术信号。",
  emptyBody:
    "这一周的信号发布后会在这里按优先级汇总。你可以先浏览全部技术信号或往期周回顾。",
  browse: "浏览技术信号",
  pagerLabel: "周回顾翻页",
  archiveHeading: "往期周回顾",
  archiveCount: (n: number) => `${n} 周`,
  archiveCounts: (high: number, watch: number, total: number) =>
    `立即关注 ${high} · 值得跟踪 ${watch} · ${total} 条信号`,
  subscribeHeading: "订阅",
  subscribeCadence: "每周一条",
  subscribeLink: "订阅本周回顾（RSS）",
  subscribeHint:
    "把这个订阅源加进任何 RSS 阅读器，每个自然周的立即关注与值得跟踪信号会自动送达，无需账号。",
  chineseOnly: ""
};

const en: typeof zh = {
  title: "This week",
  description: "Published technology signals, week by week.",
  sectionLabel: "Weekly review",
  unavailableTitle: "This week's review cannot be built right now.",
  unavailableBody: "Published signals are gathered here week by week.",
  readDigest: "Read the briefing",
  backToThisWeek: "Back to this week",
  notFoundTitle: "Page not found",
  weekPageTitle: (range) => `${range} · Weekly review`,
  weekShellTitle: (range) => `Weekly review · ${range}`,
  weekDescription: (total, high, watch, topics) =>
    `${total} published ${total === 1 ? "signal" : "signals"} this week: ${high} for immediate attention, ${watch} worth tracking, across ${topics} ${topics === 1 ? "topic" : "topics"}.`,
  pageDescription: (range, hasSummary) =>
    hasSummary
      ? `Signals published ${range} (Monday to Sunday), by priority. The list is derived from published signals; the summary is written by the editors.`
      : `Signals published ${range} (Monday to Sunday), by priority. Derived entirely from published signals: no editor's text, no AI.`,
  stats: {
    signals: "Signals this week",
    high: "Immediate attention",
    watch: "Worth tracking",
    topics: "Topics covered"
  },
  summaryHeading: "This week in brief",
  groupLedes: {
    high_priority:
      "This week's signals that several indicators say are worth evaluating soon.",
    watch:
      "This week's changes worth keeping an eye on while they are confirmed."
  },
  groupCount: (n) => `${n} ${n === 1 ? "signal" : "signals"}`,
  sourcePrefix: "· ",
  emptyTitle: "No signal has been published this week yet.",
  emptyBody:
    "This week's signals are gathered here by priority once they are published. Meanwhile, browse all signals or past weeks.",
  browse: "Browse signals",
  pagerLabel: "Weekly review pages",
  archiveHeading: "Past weeks",
  archiveCount: (n) => `${n} ${n === 1 ? "week" : "weeks"}`,
  archiveCounts: (high, watch, total) =>
    `${high} immediate · ${watch} worth tracking · ${total} ${total === 1 ? "signal" : "signals"}`,
  subscribeHeading: "Subscribe",
  subscribeCadence: "One item a week",
  subscribeLink: "Weekly review (RSS, in Chinese)",
  subscribeHint:
    "Add this feed to any RSS reader and each week's immediate and worth-tracking signals arrive on their own, with no account.",
  chineseOnly:
    "Signal titles are in English where the source is; the editors' weekly summary is written in Chinese."
};

export const weeklyCopy: Record<Locale, typeof zh> = { zh, en };
