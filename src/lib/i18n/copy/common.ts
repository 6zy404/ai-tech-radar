import type { Locale } from "@/lib/i18n/locale";

/* Interface text of the small widgets shared by the detail pages: copy-link
   buttons, the follow chips, the on-page table of contents, the reading
   progress line, the per-item relationship view. See copy/shell.ts for the
   pattern. */

const zh = {
  copyLink: {
    copy: "复制链接",
    copied: "已复制",
    copiedStatus: "本页链接已复制。",
    blocked:
      "浏览器没有允许写入剪贴板。链接已在下面的文本框里选中，按 Ctrl+C（Mac 上 ⌘C）复制。",
    fallbackLabel: "本页链接，选中后复制"
  },
  sectionLink: {
    label: (heading: string) => `复制「${heading}」一节的链接`,
    copied: "已复制",
    addressBar: "已放进地址栏"
  },
  followTags: {
    groupLabel: "关注本页话题开关",
    topicLinkTitle: (name: string) => `查看「${name}」专题`,
    topicLink: "查看专题",
    followed: "已加入我的雷达 · ",
    view: "查看",
    hint: "点击话题，将它加入我的雷达。"
  },
  pageToc: {
    label: "本页目录",
    count: (n: number) => `${n} 节`
  },
  backToTop: "返回顶部",
  relationshipGraph: {
    eyebrow: "关系网络",
    heading: "在关系网络中的位置",
    hint: "当前条目与相邻技术、技能和背景知识的连接，点击节点可继续探索。",
    kinds: { technology: "技术", skill: "技能", knowledge: "知识" },
    viewInNetwork: "在关系网络中查看 →",
    relationTitle: (relation: string, note: string) => `${relation}：${note}`
  },
  readingTime: (minutes: number) => `约 ${minutes} 分钟读完`,
  /* 适合 A、B、C on the signal cards (home, list, digest). The names are
     the editors' Chinese text; the English site keeps them in Chinese. */
  audience: {
    label: (names: string) => `适合 ${names}`,
    join: "、"
  }
};

const en: typeof zh = {
  copyLink: {
    copy: "Copy link",
    copied: "Copied",
    copiedStatus: "Link to this page copied.",
    blocked:
      "The browser did not allow writing to the clipboard. The link is selected in the box below; press Ctrl+C (⌘C on a Mac) to copy it.",
    fallbackLabel: "Link to this page, select to copy"
  },
  sectionLink: {
    label: (heading) => `Copy the link to the section “${heading}”`,
    copied: "Copied",
    addressBar: "Now in the address bar"
  },
  followTags: {
    groupLabel: "Follow this page's topics",
    topicLinkTitle: (name) => `Open the topic “${name}”`,
    topicLink: "Topic page",
    followed: "Added to My radar · ",
    view: "View",
    hint: "Click a topic to add it to My radar."
  },
  pageToc: {
    label: "On this page",
    count: (n) => `${n} ${n === 1 ? "section" : "sections"}`
  },
  backToTop: "Back to top",
  relationshipGraph: {
    eyebrow: "Network",
    heading: "Where it sits in the network",
    hint: "How this entry connects to neighbouring signals, skills and background knowledge. Follow any link to keep exploring.",
    kinds: { technology: "Signals", skill: "Skills", knowledge: "Knowledge" },
    viewInNetwork: "View in the network →",
    relationTitle: (relation, note) => `${relation}: ${note}`
  },
  readingTime: (minutes) => `About ${minutes} min read`,
  audience: {
    label: (names) => `For ${names}`,
    join: "、"
  }
};

export const commonCopy: Record<Locale, typeof zh> = { zh, en };
