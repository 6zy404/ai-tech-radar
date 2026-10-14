import type { Locale } from "@/lib/i18n/locale";

/* Interface text of /sources. See copy/shell.ts for the pattern. */

const zh = {
  title: "信源一览",
  description: "已发布的技术信号来自哪些组织、经由哪些信源，按发布方汇总。",
  sectionLabel: "信源",
  emptyEyebrow: "暂无信源",
  emptyTitle: "还没有已发布的技术信号。",
  emptyBody: "信号发布后，会在这里按发布方汇总。",
  intro:
    "发布方是公告背后的组织，信源是它经由的那个订阅源；同一个发布方可能从几个信源进来。",
  statsLabel: "信源概览",
  statPublishers: "个发布方",
  statSignals: "条已发布信号",
  statSources: "个信源",
  jumpLabel: "跳到发布方类型",
  sectionEyebrow: "发布方类型",
  sectionCounts: (publishers: number, signals: number) =>
    `${publishers} 个发布方 · ${signals} 条信号`,
  densityLabel: "收录",
  densitySignals: "信号",
  densitySources: "信源",
  recentOne: "最新一条",
  recentMany: (n: number) => `最近 ${n} 条`,
  via: "经由",
  seeAll: (n: number) => `看全部 ${n} 条 →`,
  chineseOnly: ""
};

const en: typeof zh = {
  title: "Sources",
  description:
    "Which organisations the published signals come from, and through which feeds, grouped by publisher.",
  sectionLabel: "Sources",
  emptyEyebrow: "No sources yet",
  emptyTitle: "No signals have been published yet.",
  emptyBody: "Once signals are published, they are grouped here by publisher.",
  intro:
    "A publisher is the organisation behind an announcement; a source is the feed it came through. One publisher can arrive through several sources.",
  statsLabel: "Sources at a glance",
  statPublishers: "publishers",
  statSignals: "published signals",
  statSources: "sources",
  jumpLabel: "Jump to a publisher type",
  sectionEyebrow: "Publisher type",
  sectionCounts: (publishers, signals) =>
    `${publishers} ${publishers === 1 ? "publisher" : "publishers"} · ${signals} ${signals === 1 ? "signal" : "signals"}`,
  densityLabel: "Holds",
  densitySignals: "signals",
  densitySources: "sources",
  recentOne: "Latest",
  recentMany: (n) => `Latest ${n}`,
  via: "Via",
  seeAll: (n) => `See all ${n} →`,
  chineseOnly:
    "Signal titles are in English where the source is; signals from Chinese sources keep their Chinese titles."
};

export const sourcesCopy: Record<Locale, typeof zh> = { zh, en };
