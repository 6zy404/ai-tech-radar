import type { Locale } from "@/lib/i18n/locale";
import type { PriorityLevel } from "@/types/content";

/* Interface text of the briefing pages: /digest (archive), /digest/today,
   /digest/[date] and their shared DailyDigestContent. The section headings
   the table of contents lists are in page-toc.ts. See copy/shell.ts. */

const zh = {
  archive: {
    title: "往期简报",
    description:
      "按月归档的已发布技术简报。每期汇总当期值得关注的技术信号与编辑判断。",
    sectionLabel: "简报归档",
    weekly: "本周回顾",
    latest: "阅读最新一期",
    count: (n: number) => `共 ${n} 期已发布简报。`,
    month: (year: string, month: number) => `${year} 年 ${month} 月`,
    counts: (high: number, watch: number) =>
      `立即关注 ${high} 条${watch > 0 ? ` · 值得跟踪 ${watch} 条` : ""}`,
    open: "阅读这一期",
    emptyTitle: "还没有已发布的简报。",
    emptyBody: "首期简报发布后会在这里按月归档。你可以先浏览技术信号流。",
    browse: "浏览技术信号",
    chineseOnly: ""
  },
  today: {
    fallbackTitle: "技术简报",
    showingLatest: (date: string) =>
      `当前展示的是 ${date} 发布的最新一期简报。`,
    shellTitle: "AI 技术简报",
    shellDescription: "以阅读为先的简报，汇总今天值得关注的技术信号。",
    sectionLabel: "技术简报",
    emptyEyebrow: "技术简报",
    emptyTitle: "今天还没有已发布的简报。",
    emptyBody:
      "首期简报发布后，这里会展示当天的内容。在此之前，你可以先浏览技术信号流。",
    browse: "浏览技术信号",
    notFoundTitle: "没有这一页"
  },
  content: {
    priorityReasons: {
      high_priority: "多项信号同时出现，这项技术值得尽早评估。",
      watch: "这一变化值得跟进，但仍需更多背景或验证。",
      low_priority: "可作背景了解，但今天还不够紧迫到需要优先处理。"
    } as Record<PriorityLevel, string>,
    audience: (names: string) => `适合 ${names}`,
    audienceJoin: "、",
    matchLine: (names: string) => `命中关注：${names}`,
    matchJoin: "、",
    whyItMatters: "为什么重要",
    relatedCounts: (skills: number, concepts: number) =>
      `${skills} 个技能 / ${concepts} 个概念`,
    openSignal: "查看信号",
    sourcesDescription: "本期简报中已发布技术信号所代表的公开来源。",
    publicSource: "公开来源",
    openSource: "打开来源",
    noSources: "本期简报暂无可展示的公开来源参考。",
    eyebrow: (date: string) => `技术简报 · 第 ${date} 号`,
    metaLabel: "简报摘要",
    metaHigh: (n: number) => `${n} 条立即关注`,
    metaWatch: (n: number) => `${n} 条值得跟踪`,
    metaSources: (n: number) => `${n} 个来源`,
    personalLabel: "按关注话题筛选",
    followedSummary: (follows: number, matched: number) =>
      `已关注 ${follows} 个话题，本期命中 ${matched} 条。`,
    onlyFollowed: "只看我关注的",
    noFollowsBefore:
      "关注感兴趣的话题后，简报会标出并可筛选命中你关注的内容。 ",
    toMyRadar: "前往我的雷达",
    highDescription: "精选评级最高的已发布技术信号，编辑置顶的条目优先展示。",
    noHigh: "本期简报未选入需要立即关注的信号。",
    watchDescription:
      "值得跟进的信号，但在成为立即优先项之前仍需更多背景或验证。",
    noWatch: "本期简报未选入值得跟踪的条目。",
    noMatchTitle: "本期简报没有命中你关注的话题。",
    noMatchBefore: "可以查看全部内容，或到",
    noMatchLink: "我的雷达",
    noMatchAfter: "调整关注的话题。",
    showAll: "查看全部内容",
    skillsDescription: "帮助读者判断接下来该尝试、评估或学习什么的技能。",
    noSkills: "本期简报暂未选入相关技能。",
    openSkill: "查看技能",
    knowledgeDescription: "解释今天所选变化背后背景的概念。",
    noKnowledge: "本期简报暂未选入相关背景概念。",
    openConcept: "查看概念",
    pagerLabel: "简报翻页",
    feedsHeading: "订阅简报",
    feedsBody:
      "稳定的公开订阅源仅包含已发布的技术简报，草稿和已归档简报不在其中。",
    rss: "RSS 订阅源",
    json: "JSON 订阅源",
    weekly: "本周回顾",
    archive: "往期简报归档",
    chineseOnly: ""
  }
};

const en: typeof zh = {
  archive: {
    title: "Past briefings",
    description:
      "Published briefings by month. Each one gathers the signals worth attention at the time, with the editors' judgement.",
    sectionLabel: "Briefing archive",
    weekly: "This week",
    latest: "Read the latest",
    count: (n) => `${n} published ${n === 1 ? "briefing" : "briefings"}.`,
    month: (year, month) =>
      `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month - 1]} ${year}`,
    counts: (high, watch) =>
      `${high} immediate${watch > 0 ? ` · ${watch} worth tracking` : ""}`,
    open: "Read this briefing",
    emptyTitle: "No briefing has been published yet.",
    emptyBody:
      "Briefings are archived here by month once the first is published. Meanwhile, browse the signals.",
    browse: "Browse signals",
    chineseOnly: "Briefing titles and summaries are written in Chinese."
  },
  today: {
    fallbackTitle: "Briefing",
    showingLatest: (date) => `Showing the latest briefing, published ${date}.`,
    shellTitle: "AI technology briefing",
    shellDescription:
      "A briefing to read: the technology signals worth attention today.",
    sectionLabel: "Briefing",
    emptyEyebrow: "Briefing",
    emptyTitle: "No briefing has been published yet.",
    emptyBody:
      "Once the first briefing is published, it shows here. Meanwhile, browse the signals.",
    browse: "Browse signals",
    notFoundTitle: "Page not found"
  },
  content: {
    priorityReasons: {
      high_priority:
        "Several signals point the same way; worth evaluating soon.",
      watch:
        "Worth following, but it still needs more context or confirmation.",
      low_priority: "Background reading; not urgent enough to put first today."
    },
    audience: (names) => `For ${names}`,
    audienceJoin: "、",
    matchLine: (names) => `Matches: ${names}`,
    matchJoin: ", ",
    whyItMatters: "Why it matters",
    relatedCounts: (skills, concepts) =>
      `${skills} ${skills === 1 ? "skill" : "skills"} / ${concepts} ${concepts === 1 ? "concept" : "concepts"}`,
    openSignal: "Open signal",
    sourcesDescription:
      "The public sources behind the published signals in this briefing.",
    publicSource: "Public source",
    openSource: "Open source",
    noSources: "This briefing has no public source to show.",
    eyebrow: (date) => `Briefing · ${date}`,
    metaLabel: "Briefing at a glance",
    metaHigh: (n) => `${n} immediate`,
    metaWatch: (n) => `${n} worth tracking`,
    metaSources: (n) => `${n} ${n === 1 ? "source" : "sources"}`,
    personalLabel: "Filter by followed topics",
    followedSummary: (follows, matched) =>
      `You follow ${follows} ${follows === 1 ? "topic" : "topics"}; ${matched} ${matched === 1 ? "item matches" : "items match"} in this briefing.`,
    onlyFollowed: "Only what I follow",
    noFollowsBefore:
      "Follow topics you care about and the briefing marks what matches, and can filter to it. ",
    toMyRadar: "Go to My radar",
    highDescription:
      "The highest-rated published signals; the editors' pinned items come first.",
    noHigh: "This briefing has nothing that needs immediate attention.",
    watchDescription:
      "Worth following, but each needs more context or confirmation before it becomes a priority.",
    noWatch: "This briefing has nothing marked worth tracking.",
    noMatchTitle: "Nothing in this briefing matches the topics you follow.",
    noMatchBefore: "See everything, or adjust your topics in ",
    noMatchLink: "My radar",
    noMatchAfter: ".",
    showAll: "Show everything",
    skillsDescription:
      "Skills that help you decide what to try, evaluate or learn next.",
    noSkills: "This briefing has no related skills.",
    openSkill: "Open skill",
    knowledgeDescription:
      "Concepts that explain the background to today's changes.",
    noKnowledge: "This briefing has no related background concepts.",
    openConcept: "Open concept",
    pagerLabel: "Briefing pages",
    feedsHeading: "Subscribe",
    feedsBody:
      "The public feeds carry published briefings only, never drafts or archived ones. They are in Chinese.",
    rss: "RSS feed",
    json: "JSON feed",
    weekly: "This week",
    archive: "Past briefings",
    chineseOnly:
      "The briefing's title, the editors' summary and their notes are written in Chinese, as are skill and knowledge entries."
  }
};

export const digestCopy: Record<Locale, typeof zh> = { zh, en };
