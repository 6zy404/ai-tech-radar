import type { Locale } from "@/lib/i18n/locale";

/* Interface text of the home page. See copy/shell.ts for the pattern. */

const zh = {
  shellDescription: "发现、理解并持续跟踪值得优先关注的 AI 技术信号。",
  sectionLabel: "AI 技术发现",
  hero: {
    eyebrow: "AI 技术发现",
    title: "发现值得关注的 AI 技术",
    lede: "一条清晰的阅读路径，帮你理解它为何重要、掌握所需背景。",
    readDigest: "阅读最新简报",
    browse: "浏览技术信号",
    statSignals: "条已发布技术信号",
    statSkills: "项理解与应用技能",
    statKnowledge: "个背景知识概念"
  },
  digest: {
    eyebrow: "从这里开始",
    heading: "最新技术简报",
    open: "打开简报",
    high: (n: number) => `${n} 条立即关注`,
    watch: (n: number) => `${n} 条值得跟踪`,
    emptyTitle: "还没有已发布简报。",
    emptyBody: "你可以先浏览已发布技术信号，等新一期简报发布后这里会展示它。",
    browse: "浏览技术信号"
  },
  priority: {
    eyebrow: "优先技术信号",
    heading: "现在最值得关注",
    all: "查看全部信号",
    whyItMatters: "为什么重要",
    emptyTitle: "还没有已发布技术信号。",
    emptyBody: "发布正式技术记录后，这里会突出最值得先读的内容。"
  },
  news: {
    eyebrow: "今日快讯",
    heading: "来源里正在发生什么",
    all: "查看全部快讯",
    empty: "最近还没有自动聚合的快讯。来源定时导入后，这里会展示最新资讯。"
  },
  skills: {
    eyebrow: "技能",
    heading: "建立判断技术信号的能力",
    all: "查看技能",
    linked: (n: number) => `已关联 ${n} 条已发布技术信号。`
  },
  knowledge: {
    eyebrow: "知识",
    heading: "用稳定概念理解新变化",
    all: "查看知识",
    explains: (n: number) => `已解释 ${n} 条已发布技术信号。`
  },
  chineseOnly: ""
};

const en: typeof zh = {
  shellDescription:
    "Discover, understand and keep track of the AI technology signals worth attention first.",
  sectionLabel: "AI technology discovery",
  hero: {
    eyebrow: "AI technology discovery",
    title: "Find the AI technologies worth your attention",
    lede: "A clear reading path: why each one matters, and the background you need to follow it.",
    readDigest: "Read the latest briefing",
    browse: "Browse signals",
    statSignals: "published signals",
    statSkills: "skills to understand and apply them",
    statKnowledge: "background concepts"
  },
  digest: {
    eyebrow: "Start here",
    heading: "Latest briefing",
    open: "Open the briefing",
    high: (n) => `${n} for immediate attention`,
    watch: (n) => `${n} worth tracking`,
    emptyTitle: "No briefing has been published yet.",
    emptyBody:
      "Browse the published signals meanwhile; the next briefing shows here once it is out.",
    browse: "Browse signals"
  },
  priority: {
    eyebrow: "Priority signals",
    heading: "Most worth your attention now",
    all: "See all signals",
    whyItMatters: "Why it matters",
    emptyTitle: "No signal has been published yet.",
    emptyBody:
      "Once signals are published, the ones to read first are featured here."
  },
  news: {
    eyebrow: "Today's news",
    heading: "What is happening at the sources",
    all: "See all news",
    empty:
      "No news has been gathered recently. Once the sources are imported on schedule, the latest items show here."
  },
  skills: {
    eyebrow: "Skills",
    heading: "Build the skills to judge a signal",
    all: "View skills",
    linked: (n) => `Linked to ${n} published ${n === 1 ? "signal" : "signals"}.`
  },
  knowledge: {
    eyebrow: "Knowledge",
    heading: "Understand new changes through stable concepts",
    all: "View knowledge",
    explains: (n) =>
      `Explains ${n} published ${n === 1 ? "signal" : "signals"}.`
  },
  chineseOnly:
    "Signal titles and summaries are in English where the source is. The editors' notes, the briefings, and the skill and knowledge entries are written in Chinese."
};

export const homeCopy: Record<Locale, typeof zh> = { zh, en };
