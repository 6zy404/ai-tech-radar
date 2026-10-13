import type { Locale } from "@/lib/i18n/locale";

/* Interface text of /topics, /topics/[tagId], the topic mini graph and the
   关注此话题 switch. See copy/shell.ts for the pattern. */

const zh = {
  index: {
    title: "按话题浏览",
    description:
      "每个话题把同一主题下的已发布技术信号、技能和背景知识放在一起。",
    sectionLabel: "话题",
    emptyEyebrow: "暂无话题",
    emptyTitle: "还没有带话题的已发布内容。",
    emptyBody: "信号、技能或知识发布并标注话题后，会在这里按话题汇总。",
    intro:
      "信号最多的话题排在前面；打开一个话题，能看到它下面的全部内容和图谱里的相邻条目。",
    statsLabel: "话题概览",
    statTopics: "个话题",
    statSignals: "条已发布信号",
    statSkills: "项技能",
    statKnowledge: "条背景知识",
    densityLabel: "收录",
    densitySignals: "信号",
    densitySkills: "技能",
    densityKnowledge: "知识",
    open: "查看专题"
  },
  hub: {
    notFoundTitle: "没有这一页",
    pageTitle: (name: string) => `${name} · 专题`,
    feedTitle: (siteName: string, name: string) =>
      `${siteName} · 话题：${name}`,
    sectionLabel: "主题聚合",
    allTopics: "全部话题",
    followHeading: "跟进此话题",
    followModesBoth: "站内关注 · 站外订阅",
    followModesSite: "站内关注",
    followOnSite: "站内 · 我的雷达",
    followOffSite: "站外 · RSS 阅读器",
    feedLink: "RSS 订阅源",
    feedHint: (name: string) =>
      `把这个订阅源加进任何 RSS 阅读器，「${name}」下新发布的技术信号会自动送达，无需账号。`,
    signalsHeading: "已发布技术信号",
    signalsCount: (n: number) => `${n} 条`,
    skillsHeading: "相关技能",
    skillsCount: (n: number) => `${n} 项`,
    knowledgeHeading: "背景知识",
    knowledgeCount: (n: number) => `${n} 条`,
    relatedHeading: "图谱关联",
    relatedNote: "来自 /network 的直接邻居",
    kinds: { technology: "技术", skill: "技能", knowledge: "知识" },
    chineseOnly: ""
  },
  graph: {
    heading: "话题图谱",
    counts: (nodes: number, edges: number) =>
      `${nodes} 个节点 · ${edges} 条连接`,
    kinds: { technology: "技术", skill: "技能", knowledge: "知识" },
    note: (
      topicName: string,
      topicTotal: number,
      shownTopic: number,
      neighborTotal: number,
      shownNeighbors: number
    ) =>
      `图中是「${topicName}」${topicTotal} 条内容里彼此联系最多的 ${shownTopic} 条` +
      (shownNeighbors > 0
        ? `，以及话题外 ${neighborTotal} 个直接邻居里与它们联系最多的 ${shownNeighbors} 个`
        : "") +
      "。完整列表在下方。",
    inside: "本话题的内容",
    outside: "话题外的邻居",
    relationTypes: "关系类型",
    viewInNetwork: "在关系网络中查看 →"
  },
  followToggle: {
    follow: "关注此话题",
    hintOff: (name: string) =>
      `关注后，「${name}」的新信号会汇总到「我关注的」，简报里也会标出。只记在这个浏览器里，无需账号。`,
    hintOn: (name: string) =>
      `已加入我的雷达，「${name}」的新信号会汇总到「我关注的」，简报里也会标出 · `,
    view: "查看"
  }
};

const en: typeof zh = {
  index: {
    title: "Browse by topic",
    description:
      "Each topic gathers the published signals, skills and background knowledge on one subject.",
    sectionLabel: "Topics",
    emptyEyebrow: "No topics yet",
    emptyTitle: "No published content carries a topic yet.",
    emptyBody:
      "Once signals, skills or knowledge are published with topics, they are gathered here by topic.",
    intro:
      "Topics with the most signals come first. Open one to see everything filed under it and its neighbours in the graph.",
    statsLabel: "Topics at a glance",
    statTopics: "topics",
    statSignals: "published signals",
    statSkills: "skills",
    statKnowledge: "knowledge entries",
    densityLabel: "Holds",
    densitySignals: "signals",
    densitySkills: "skills",
    densityKnowledge: "knowledge",
    open: "Open topic"
  },
  hub: {
    notFoundTitle: "Page not found",
    pageTitle: (name) => `${name} · Topic`,
    feedTitle: (siteName, name) => `${siteName} · Topic: ${name} (in Chinese)`,
    sectionLabel: "Topic",
    allTopics: "All topics",
    followHeading: "Follow this topic",
    followModesBoth: "On this site · Elsewhere",
    followModesSite: "On this site",
    followOnSite: "On this site · My radar",
    followOffSite: "Elsewhere · RSS reader",
    feedLink: "RSS feed",
    feedHint: (name) =>
      `Add this feed to any RSS reader and new signals under “${name}” arrive on their own, with no account. The feed is in Chinese.`,
    signalsHeading: "Published signals",
    signalsCount: (n) => `${n} ${n === 1 ? "signal" : "signals"}`,
    skillsHeading: "Related skills",
    skillsCount: (n) => `${n} ${n === 1 ? "skill" : "skills"}`,
    knowledgeHeading: "Background knowledge",
    knowledgeCount: (n) => `${n} ${n === 1 ? "entry" : "entries"}`,
    relatedHeading: "Graph neighbours",
    relatedNote: "Direct neighbours from /network",
    kinds: { technology: "Signal", skill: "Skill", knowledge: "Knowledge" },
    chineseOnly:
      "Skills and knowledge entries are written in Chinese, as are signals from Chinese sources."
  },
  graph: {
    heading: "Topic graph",
    counts: (nodes, edges) =>
      `${nodes} ${nodes === 1 ? "node" : "nodes"} · ${edges} ${edges === 1 ? "link" : "links"}`,
    kinds: { technology: "Signal", skill: "Skill", knowledge: "Knowledge" },
    note: (topicName, topicTotal, shownTopic, neighborTotal, shownNeighbors) =>
      `The graph shows the ${shownTopic} of the ${topicTotal} entries under “${topicName}” that are most connected to each other` +
      (shownNeighbors > 0
        ? `, and the ${shownNeighbors} of the topic's ${neighborTotal} direct outside neighbours most connected to them`
        : "") +
      ". The full lists are below.",
    inside: "Entries in this topic",
    outside: "Neighbours outside the topic",
    relationTypes: "Relation types",
    viewInNetwork: "View in the network →"
  },
  followToggle: {
    follow: "Follow this topic",
    hintOff: (name) =>
      `Once followed, new signals under “${name}” are gathered in “Following” and marked in the briefings. Remembered in this browser only; no account needed.`,
    hintOn: (name) =>
      `Added to My radar: new signals under “${name}” are gathered in “Following” and marked in the briefings · `,
    view: "View"
  }
};

export const topicsCopy: Record<Locale, typeof zh> = { zh, en };
