import type { Locale } from "@/lib/i18n/locale";

/* Interface text of the skill and knowledge detail pages
   (`ContentDetailPage`). Each kind has its own block; `shared` is what both
   kinds print. See copy/shell.ts for the pattern. */

interface KindCopy {
  /** The page title suffix. */
  noun: string;
  sectionLabel: string;
  leadHeading: string;
  graphHint: string;
  technologySection: { eyebrow: string; heading: string; noteLabel: string };
  bodyMentions?: {
    eyebrow: string;
    heading: string;
    note: string;
    excludedNote: string;
  };
  related: {
    eyebrow: string;
    heading: string;
    fallbackNote: string;
    linkText: string;
    countLabel: string;
  };
  asideLabel: string;
  profileKicker: string;
  /** Profile row labels, in the order the kind lists them. */
  profileLabels: string[];
  readingPath: string;
  /** English site only: the line saying the entry is in Chinese. */
  chineseOnly: string;
}

interface SharedCopy {
  entryKinds: Record<
    "skill" | "knowledge",
    { label: string; linkText: string }
  >;
  prerequisitesEyebrow: string;
  prerequisitesHeading: string;
  whyFirst: string;
  readBefore: (title: string) => string;
  viewSignal: string;
  moreRows: (n: number) => string;
  /** 「note；excluded。」 when both, 「note。」 alone. */
  mentionsNote: (note: string, excluded?: string) => string;
  profileSignals: string;
  topics: string;
  readingPathKicker: string;
  notFoundTitle: string;
}

const zh: {
  skill: KindCopy;
  knowledge: KindCopy;
  shared: SharedCopy;
} = {
  skill: {
    noun: "技能",
    sectionLabel: "理解技能",
    leadHeading: "这项技能能帮你做什么",
    graphHint: "这项技能相邻的技术信号与背景概念，点击节点可继续探索。",
    technologySection: {
      eyebrow: "用已发布信号练习",
      heading: "这项技能有助于评估的技术信号",
      noteLabel: "为什么重要"
    },
    related: {
      eyebrow: "背景概念",
      heading: "与这项技能搭配的知识",
      fallbackNote:
        "理解这个概念，能帮你在解读新技术信号时更好地运用这项技能。",
      linkText: "查看概念",
      countLabel: "背景概念"
    },
    asideLabel: "技能概览",
    profileKicker: "技能档案",
    profileLabels: ["类别", "当前热度", "学习成本"],
    readingPath: "先读技能说明，打开一条相关信号，再用关联概念补齐背景。",
    chineseOnly: ""
  },
  knowledge: {
    noun: "知识",
    sectionLabel: "背景知识",
    leadHeading: "这个概念是什么意思",
    graphHint: "这个概念相邻的技术信号与相关技能，点击节点可继续探索。",
    technologySection: {
      eyebrow: "可解释",
      heading: "这个概念能解释的技术信号",
      noteLabel: "这个概念在这里如何体现"
    },
    bodyMentions: {
      eyebrow: "自动匹配",
      heading: "正文里提到它的信号",
      note: "按正文自动匹配，未经编辑挑选",
      excludedNote: "上一节已列出的不再重复"
    },
    related: {
      eyebrow: "搭配技能",
      heading: "使用这个概念的技能",
      fallbackNote: "有了这个概念，这项技能会更容易练习和应用。",
      linkText: "查看技能",
      countLabel: "关联技能"
    },
    asideLabel: "知识概览",
    profileKicker: "知识档案",
    profileLabels: ["类别", "难度"],
    readingPath:
      "先从概念开始，打开一条相关信号，再用关联技能决定接下来评估什么。",
    chineseOnly: ""
  },
  shared: {
    entryKinds: {
      skill: { label: "技能", linkText: "查看技能" },
      knowledge: { label: "知识", linkText: "查看概念" }
    },
    prerequisitesEyebrow: "阅读顺序",
    prerequisitesHeading: "先读这些",
    whyFirst: "为什么先读",
    readBefore: (title) => `先于「${title}」`,
    viewSignal: "查看相关信号",
    moreRows: (n) => `再看 ${n} 条`,
    mentionsNote: (note, excluded) =>
      excluded ? `${note}；${excluded}。` : `${note}。`,
    profileSignals: "技术信号",
    topics: "主题",
    readingPathKicker: "阅读路径",
    notFoundTitle: "没有这一页"
  }
};

const en: typeof zh = {
  skill: {
    noun: "Skill",
    sectionLabel: "Skills",
    leadHeading: "What this skill helps you do",
    graphHint:
      "The signals and background concepts next to this skill. Follow any link to keep exploring.",
    technologySection: {
      eyebrow: "Practise on published signals",
      heading: "Signals this skill helps you evaluate",
      noteLabel: "Why it matters"
    },
    related: {
      eyebrow: "Background concepts",
      heading: "Knowledge that pairs with this skill",
      fallbackNote:
        "Understanding this concept helps you apply the skill when reading new signals.",
      linkText: "Open concept",
      countLabel: "Background concepts"
    },
    asideLabel: "Skill overview",
    profileKicker: "Skill profile",
    profileLabels: ["Area", "Current heat", "Learning cost"],
    readingPath:
      "Read the skill first, open a related signal, then fill in the background with the linked concepts.",
    chineseOnly: "This skill is written in Chinese."
  },
  knowledge: {
    noun: "Knowledge",
    sectionLabel: "Background knowledge",
    leadHeading: "What this concept means",
    graphHint:
      "The signals and skills next to this concept. Follow any link to keep exploring.",
    technologySection: {
      eyebrow: "Explains",
      heading: "Signals this concept explains",
      noteLabel: "How the concept shows up here"
    },
    bodyMentions: {
      eyebrow: "Matched automatically",
      heading: "Signals that mention it",
      note: "Matched from the signals' text, not picked by an editor",
      excludedNote: "those listed in the section above are not repeated"
    },
    related: {
      eyebrow: "Paired skills",
      heading: "Skills that use this concept",
      fallbackNote:
        "With this concept in hand, the skill is easier to practise and apply.",
      linkText: "Open skill",
      countLabel: "Linked skills"
    },
    asideLabel: "Knowledge overview",
    profileKicker: "Concept profile",
    profileLabels: ["Category", "Difficulty"],
    readingPath:
      "Start with the concept, open a related signal, then use the linked skills to decide what to evaluate next.",
    chineseOnly: "This concept is written in Chinese."
  },
  shared: {
    entryKinds: {
      skill: { label: "Skill", linkText: "Open skill" },
      knowledge: { label: "Knowledge", linkText: "Open concept" }
    },
    prerequisitesEyebrow: "Reading order",
    prerequisitesHeading: "Read these first",
    whyFirst: "Why read it first",
    readBefore: (title) => `Before “${title}”`,
    viewSignal: "Open signal",
    moreRows: (n) => `Show ${n} more`,
    mentionsNote: (note, excluded) =>
      excluded ? `${note}; ${excluded}.` : `${note}.`,
    profileSignals: "Signals",
    topics: "Topics",
    readingPathKicker: "Reading path",
    notFoundTitle: "Page not found"
  }
};

export const contentDetailCopy: Record<Locale, typeof zh> = { zh, en };
