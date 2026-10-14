import type { Locale } from "@/lib/i18n/locale";
import { importantFreshnessWindowDays } from "@/lib/priority-window";

/* Interface text of /technologies and its five views, the signal card, and
   the reading widgets those views share (稍后读 / 已读, keyboard shortcuts,
   the language switch, new-signal alerts, local recommendations). See
   copy/shell.ts for the pattern. */

type View = "curated" | "news" | "timeline" | "followed" | "saved";

const zh = {
  page: {
    title: "技术信号",
    sectionLabel: "已发布信号",
    // 全部快讯 is mostly candidates no editor has looked at yet, so it is not
    // labelled as published.
    sectionLabelNews: "自动聚合快讯",
    viewTitle: (tab: string, title: string) => `${tab} · ${title}`,
    tabs: {
      curated: "精选",
      news: "全部快讯",
      timeline: "按话题",
      followed: "我关注的",
      saved: "稍后读"
    } as Record<View, string>,
    descriptions: {
      curated: "浏览已发布的 AI 技术信号，决定先读哪一条。",
      news: "最近 7 天从外部来源自动聚合的 AI 资讯，按日期分组。想看有编辑判断的内容，请切换到「精选」或阅读技术简报。",
      timeline:
        "按话题查看已发布技术信号的时间演进：同一主题下先后发生了什么，一眼看清脉络。",
      followed:
        "关注你在意的话题，按优先级聚合命中的已发布技术信号。关注状态只保存在你的浏览器里。",
      saved:
        "你标记为「稍后读」的技术信号，最近保存的排在前面。已读与稍后读的标记只保存在你的浏览器里。"
    } as Record<View, string>,
    sources: "信源一览",
    about: "怎么挑信号",
    rss: "RSS 订阅",
    tabsLabel: "技术信号视图切换",
    chineseOnly: ""
  },
  browser: {
    sortLatest: "最新发布",
    sortPriority: "按优先级档位",
    allTypes: "全部类型",
    allTags: "全部标签",
    allPriorities: "全部优先级",
    allPublishers: "全部发布方",
    searchPlaceholder: "搜索标题、摘要或来源",
    searchLabel: "搜索技术信号",
    count: (n: number) => `${n} 条技术信号`,
    newSinceVisit: (n: number) => `上次来访后新增 ${n} 条`,
    sortLabel: "排序",
    allReadTitle: "这一批信号你都读过了。",
    allReadBody: "关掉「隐藏已读」可以重新看到它们。",
    emptyTitle: "暂无技术信号。",
    emptyBody: "试着清除筛选条件，查看已发布的信号。"
  },
  card: {
    catalog: (type: string, date: string) => `${type} · 第 ${date} 号`,
    read: "已读",
    whyItMatters: "为什么重要",
    open: "查看信号 →"
  },
  readingActions: {
    saved: "已加入稍后读",
    save: "稍后读",
    read: "已读",
    markRead: "标为已读"
  },
  readFilter: {
    count: (n: number) => `已读 ${n} 条`,
    show: "显示已读",
    hide: "隐藏已读"
  },
  shortcuts: {
    keys: {
      move: "下一条 / 上一条信号",
      open: "打开当前信号",
      save: "加入或移出稍后读",
      read: "标为已读或取消",
      help: "打开这份说明",
      close: "关闭说明"
    },
    title: "键盘快捷键",
    note: "在输入框里打字，或按着 Ctrl、Alt、⌘ 时，这些键照常使用。",
    switchLabel: "关闭单键快捷键",
    switchHint: "j、k、Enter、o、s、x 不再响应，? 仍可打开这份说明",
    close: "关闭",
    hint: "快捷键",
    selectFirst: "先按 j 选中一条信号。",
    unsaved: "已移出稍后读。",
    saved: "已加入稍后读。",
    unread: "已取消已读。",
    read: "已标为已读。"
  },
  languageSwitch: {
    label: "阅读语言",
    zh: "中文",
    original: "原文"
  },
  news: {
    today: "今天",
    yesterday: "昨天",
    disclaimer: "自动聚合内容，未经编辑精选，以来源原文为准。",
    total: (n: number) => ` 当前共 ${n} 条。`,
    dayCount: (date: string, n: number) => `${date} · ${n} 条`,
    emptyTitle: (days: number) => `最近 ${days} 天还没有新的快讯。`,
    emptyBody:
      "外部来源会定时自动导入，导入后这里会按天展示最新资讯。你可以先阅读经过编辑精选的技术信号。",
    signalLink: (title: string) => `已收录为精选技术信号：${title}`
  },
  timeline: {
    allTopics: "查看全部话题",
    jumpLabel: "跳到话题",
    count: (total: number) => `${total} 条信号`,
    recent: (limit: number) => ` · 最近 ${limit} 条`,
    viewTopicAll: (total: number) => `查看专题 · 共 ${total} 条 →`,
    viewTopic: "查看专题 →",
    emptyTitle: "还没有可以展示的信号时间线。",
    emptyBody: "技术信号发布后会按话题在这里聚合。"
  },
  myRadar: {
    groupLedes: {
      high_priority: `命中你关注话题，且编辑标为关键、或标为重要且发布不满 ${importantFreshnessWindowDays} 天的信号。`,
      watch: "命中你关注话题、值得持续留意的变化。",
      low_priority: "命中你关注话题的背景型内容，空闲时浏览。"
    },
    nothingToExport: "还没有关注任何话题，无可导出。",
    exported: "关注码已复制，在另一台设备上点「导入关注」粘贴即可。",
    copyPrompt: "复制这段关注码，在另一台设备上导入：",
    pastePrompt: "粘贴另一台设备导出的关注码：",
    invalidCode: "关注码无效：没有识别出任何话题。",
    imported: (n: number) => `已导入 ${n} 个话题的关注。`,
    eyebrow: "关注话题",
    heading: "选择你想跟踪的话题",
    lede: "点击话题即可关注或取消，不需要账号。",
    toggleGroupLabel: "关注话题开关",
    export: "导出关注",
    import: "导入关注",
    feedsLede:
      "话题订阅源：把链接加进任何 RSS 阅读器，新发布的信号会自动送达，换设备也不丢。",
    feedLink: (name: string) => `${name} RSS`,
    noFollowsTitle: "还没有关注任何话题。",
    noFollowsBody:
      "在上方选择几个感兴趣的话题，你的雷达就会按优先级聚合命中这些话题的已发布技术信号。",
    noMatchesTitle: "你关注的话题暂时没有命中的已发布信号。",
    noMatchesBefore: "可以再关注几个相邻话题，或先到",
    noMatchesLink: "技术信号流",
    noMatchesAfter: "看看全部已发布内容。",
    matchLine: (names: string[]) => `命中关注：${names.join("、")}`
  },
  saved: {
    exported:
      "阅读码已复制，在另一台设备的「稍后读」里点「导入阅读码」粘贴即可。",
    copyPrompt: "复制这段阅读码，在另一台设备上导入：",
    pastePrompt: "粘贴另一台设备导出的阅读码：",
    invalidCode:
      "阅读码无效：应以 rm1: 开头。话题的关注码请到「我关注的」导入。",
    transferLabel: "换设备",
    export: "导出阅读码",
    import: "导入阅读码",
    loading: "正在读取本地的稍后读列表…",
    emptyTitle: "你的稍后读还是空的。",
    emptyBefore: "在",
    emptyLink: "「精选」",
    emptyAfter:
      "里看到想回头细读的信号，点一下「稍后读」，它就会攒到这里。标记只保存在这台设备的浏览器里。",
    emptyImport: "换了设备？把旧设备上导出的阅读码导入进来。",
    count: (n: number) => `已攒下 ${n} 条信号。`,
    allReadTitle: "攒下的信号你都读完了。",
    allReadBody: "关掉「隐藏已读」可以回看，或者取消「稍后读」把它们清出列表。",
    importResult: {
      saved: (n: number) => `稍后读 ${n}`,
      read: (n: number) => `已读 ${n}`,
      added: (n: number, kinds: string[]) =>
        `导入 ${n} 条（${kinds.join(" · ")}）`,
      nothingNew: "没有新的标记",
      alreadyPresent: (n: number) => `${n} 条本机已有`,
      ignored: (n: number) => `忽略 ${n} 条无法识别或已下线的信号`,
      join: (parts: string[]) => `${parts.join("，")}。`
    }
  },
  push: {
    turnedOff: "已关闭提醒，服务器上的记录已删除。",
    turnedOn: (n: number) =>
      `已开启：${n} 个关注话题有新信号时，这个浏览器会收到一条通知。`,
    unsupported:
      "这个浏览器不支持网页提醒（iPhone 和 iPad 需要先「添加到主屏幕」）。",
    toggle: "有新信号时提醒我",
    onNote: "关注的话题有新信号时会收到浏览器通知。",
    offNote: "开启后，服务器会存下这个浏览器的推送地址和你关注的话题，",
    privacyLink: "存什么、怎么删",
    errors: {
      unsupported: "这个浏览器不支持网页提醒。",
      disabled: "本站暂未开启新信号提醒。",
      denied: "浏览器没有允许通知。可以在地址栏左侧的网站设置里改回「允许」。",
      noResponse: "浏览器的推送服务没有响应，稍后再试。",
      enableFailed: "开启失败，稍后再试。",
      disableFailed: "关闭失败，稍后再试。"
    }
  },
  recommend: {
    eyebrow: "本机推荐",
    noteLabel: "为什么推荐",
    heading: "和你读过的相近",
    privacyFirst: "按你在本机的阅读记录计算，",
    privacySecond: "记录不离开浏览器。",
    reason: (verb: "read" | "saved", title: string, topicNames: string[]) =>
      `和你${verb === "read" ? "读过" : "存下"}的《${title}》相近` +
      (topicNames.length > 0
        ? `，也属于你关注的${topicNames.map((name) => `「${name}」`).join("")}`
        : "")
  },
  newStamp: "新"
};

const en: typeof zh = {
  page: {
    title: "Signals",
    sectionLabel: "Published signals",
    sectionLabelNews: "Auto-aggregated news",
    viewTitle: (tab, title) => `${tab} · ${title}`,
    tabs: {
      curated: "Curated",
      news: "All news",
      timeline: "By topic",
      followed: "Following",
      saved: "Read later"
    },
    descriptions: {
      curated:
        "Browse the published AI technology signals and decide which to read first.",
      news: "AI news gathered automatically from outside sources over the last 7 days, grouped by day. For the editors' picks, switch to “Curated” or read a briefing.",
      timeline:
        "Published signals by topic, in order: what happened under each subject, and when.",
      followed:
        "Follow the topics you care about and the matching published signals are gathered by priority. What you follow is stored only in your browser.",
      saved:
        "The signals you marked “Read later”, most recently saved first. Read and read-later marks are stored only in your browser."
    },
    sources: "Sources",
    about: "How signals are picked",
    rss: "RSS (in Chinese)",
    tabsLabel: "Signal views",
    chineseOnly:
      "Titles and summaries are in English where the source is; the editors' notes and signals from Chinese sources are in Chinese."
  },
  browser: {
    sortLatest: "Newest",
    sortPriority: "By priority band",
    allTypes: "All types",
    allTags: "All topics",
    allPriorities: "All priorities",
    allPublishers: "All publishers",
    searchPlaceholder: "Search titles, summaries or sources",
    searchLabel: "Search signals",
    count: (n) => `${n} ${n === 1 ? "signal" : "signals"}`,
    newSinceVisit: (n) => `${n} new since your last visit`,
    sortLabel: "Sort",
    allReadTitle: "You have read every signal here.",
    allReadBody: "Turn off “Hide read” to see them again.",
    emptyTitle: "No signals.",
    emptyBody: "Try clearing the filters to see the published signals."
  },
  card: {
    catalog: (type, date) => `${type} · ${date}`,
    read: "Read",
    whyItMatters: "Why it matters",
    open: "Open signal →"
  },
  readingActions: {
    saved: "Saved for later",
    save: "Read later",
    read: "Read",
    markRead: "Mark as read"
  },
  readFilter: {
    count: (n) => `${n} read`,
    show: "Show read",
    hide: "Hide read"
  },
  shortcuts: {
    keys: {
      move: "Next / previous signal",
      open: "Open the current signal",
      save: "Add to or remove from Read later",
      read: "Mark as read, or undo",
      help: "Open this list",
      close: "Close this list"
    },
    title: "Keyboard shortcuts",
    note: "While you type in a box, or hold Ctrl, Alt or ⌘, these keys work as usual.",
    switchLabel: "Turn off single-key shortcuts",
    switchHint:
      "j, k, Enter, o, s and x stop responding; ? still opens this list",
    close: "Close",
    hint: "Shortcuts",
    selectFirst: "Press j to pick a signal first.",
    unsaved: "Removed from Read later.",
    saved: "Added to Read later.",
    unread: "Marked as unread.",
    read: "Marked as read."
  },
  languageSwitch: {
    label: "Reading language",
    zh: "中文",
    original: "Original"
  },
  news: {
    today: "Today",
    yesterday: "Yesterday",
    disclaimer:
      "Gathered automatically, not picked by an editor; the original source is authoritative.",
    total: (n) => ` ${n} ${n === 1 ? "item" : "items"} right now.`,
    dayCount: (date, n) => `${date} · ${n} ${n === 1 ? "item" : "items"}`,
    emptyTitle: (days) => `No news in the last ${days} days.`,
    emptyBody:
      "Outside sources are imported on a schedule, and new items show up here by day. Meanwhile, read the editors' curated signals.",
    signalLink: (title) => `Curated as a signal: ${title}`
  },
  timeline: {
    allTopics: "All topics",
    jumpLabel: "Jump to a topic",
    count: (total) => `${total} ${total === 1 ? "signal" : "signals"}`,
    recent: (limit) => ` · latest ${limit}`,
    viewTopicAll: (total) => `Open topic · all ${total} →`,
    viewTopic: "Open topic →",
    emptyTitle: "No signal timeline to show yet.",
    emptyBody: "Published signals are gathered here by topic."
  },
  myRadar: {
    groupLedes: {
      high_priority: `In the topics you follow, and marked critical, or important and published within the last ${importantFreshnessWindowDays} days.`,
      watch: "In the topics you follow, and worth keeping an eye on.",
      low_priority: "Background reading in the topics you follow."
    },
    nothingToExport:
      "You do not follow any topic yet, so there is nothing to export.",
    exported:
      "Follow code copied. On another device, choose “Import follows” and paste it.",
    copyPrompt: "Copy this follow code and import it on another device:",
    pastePrompt: "Paste the follow code exported on another device:",
    invalidCode: "That follow code is not valid: no topic was recognised.",
    imported: (n) => `Imported ${n} followed ${n === 1 ? "topic" : "topics"}.`,
    eyebrow: "Followed topics",
    heading: "Pick the topics you want to track",
    lede: "Click a topic to follow or unfollow it. No account needed.",
    toggleGroupLabel: "Follow topics",
    export: "Export follows",
    import: "Import follows",
    feedsLede:
      "Topic feeds: add a link to any RSS reader and new signals arrive on their own, on any device. The feeds are in Chinese.",
    feedLink: (name) => `${name} RSS`,
    noFollowsTitle: "You do not follow any topic yet.",
    noFollowsBody:
      "Pick a few topics above and your radar gathers the published signals in them, by priority.",
    noMatchesTitle: "No published signal matches your topics yet.",
    noMatchesBefore: "Follow a few neighbouring topics, or go to ",
    noMatchesLink: "the signal stream",
    noMatchesAfter: " to see everything published.",
    matchLine: (names) => `Matches: ${names.join(", ")}`
  },
  saved: {
    exported:
      "Reading code copied. On another device, open “Read later”, choose “Import reading code” and paste it.",
    copyPrompt: "Copy this reading code and import it on another device:",
    pastePrompt: "Paste the reading code exported on another device:",
    invalidCode:
      "That reading code is not valid: it should start with rm1:. Topic follow codes are imported under “Following”.",
    transferLabel: "Move to another device",
    export: "Export reading code",
    import: "Import reading code",
    loading: "Reading your local Read later list…",
    emptyTitle: "Your Read later list is empty.",
    emptyBefore: "When something in ",
    emptyLink: "“Curated”",
    emptyAfter:
      " is worth a closer read later, click “Read later” and it collects here. The marks are stored only in this device's browser.",
    emptyImport: "New device? Import the reading code exported on the old one.",
    count: (n) => `${n} saved ${n === 1 ? "signal" : "signals"}.`,
    allReadTitle: "You have read everything you saved.",
    allReadBody:
      "Turn off “Hide read” to look back, or clear “Read later” to take them off the list.",
    importResult: {
      saved: (n) => `${n} read later`,
      read: (n) => `${n} read`,
      added: (n, kinds) =>
        `Imported ${n} ${n === 1 ? "mark" : "marks"} (${kinds.join(" · ")})`,
      nothingNew: "No new marks",
      alreadyPresent: (n) => `${n} already on this device`,
      ignored: (n) => `${n} ignored as unrecognised or no longer published`,
      join: (parts) => `${parts.join("; ")}.`
    }
  },
  push: {
    turnedOff: "Alerts are off, and the record on the server has been deleted.",
    turnedOn: (n) =>
      `On: this browser gets a notification when any of your ${n} followed ${n === 1 ? "topic has" : "topics have"} a new signal.`,
    unsupported:
      "This browser does not support web notifications (on iPhone and iPad, add the site to your home screen first).",
    toggle: "Alert me to new signals",
    onNote:
      "You get a browser notification when a followed topic has a new signal.",
    offNote:
      "Once on, the server stores this browser's push address and the topics you follow. ",
    privacyLink: "What is stored, and how to delete it",
    errors: {
      unsupported: "This browser does not support web notifications.",
      disabled: "New-signal alerts are not switched on for this site yet.",
      denied:
        "The browser did not allow notifications. You can change it back to “Allow” in the site settings at the left of the address bar.",
      noResponse:
        "The browser's push service did not respond; try again later.",
      enableFailed: "Could not turn alerts on; try again later.",
      disableFailed: "Could not turn alerts off; try again later."
    }
  },
  recommend: {
    eyebrow: "On this device",
    noteLabel: "Why this",
    heading: "Close to what you read",
    privacyFirst: "Worked out from your reading on this device; ",
    privacySecond: "the marks never leave the browser.",
    reason: (verb, title, topicNames) =>
      `Close to “${title}”, which you ${verb === "read" ? "read" : "saved"}` +
      (topicNames.length > 0
        ? `; also in ${topicNames.map((name) => `“${name}”`).join(" and ")}, which you follow`
        : "")
  },
  newStamp: "New"
};

export const signalsCopy: Record<Locale, typeof zh> = { zh, en };
