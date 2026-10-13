import type { Locale } from "@/lib/i18n/locale";

/* Interface text of the signal page (/technologies/[slug]) and the pieces
   only it uses: the release line, the source block, the related sections,
   the three AI widgets and the previous/next pager (shared with the digest
   and weekly pages). See copy/shell.ts for the pattern. */

type PagerUnit = "期" | "周" | "条";

const zh = {
  page: {
    notFoundTitle: "没有这一页",
    shellTitle: "技术详情",
    shellDescription:
      "以阅读为先，呈现已发布信号、来源，以及帮助理解它的技能与知识。",
    shellSectionLabel: "已发布技术",
    defaultSkillNote: "这项技能有助于评估技术信号或据此采取行动。",
    defaultKnowledgeNote: "这条知识为理解该技术信号提供背景。",
    defaultTechnologyNote: "与该信号相邻的技术，可顺着这条线继续了解。"
  },
  hero: {
    catalog: (type: string, date: string) => `${type} · 第 ${date} 号`
  },
  aside: {
    priority: "优先级",
    difficulty: "阅读难度"
  },
  sections: {
    bodyEyebrow: "记录",
    bodyHeading: "信号正文",
    whyEyebrow: "为什么是现在",
    whyHeading: "为什么重要",
    contextEyebrow: "背景",
    contextHeading: "技术背景",
    audienceEyebrow: "关注人群",
    audienceHeading: "谁该关注",
    impactAreas: "可能影响的领域",
    learningEyebrow: "下一步",
    learningHeading: "学习路径",
    graphHeading: "在技术网络中的位置",
    graphHint: "当前技术与相邻技术、技能和背景知识的连接，点击节点可继续探索。",
    relatedTechnologies: "相关技术",
    relatedTechnologiesDescription:
      "与该信号在工作流或主题上相邻的其他技术，可顺着这条线继续了解。",
    viewTechnology: "查看技术",
    similarHeading: "内容相近的信号",
    similarDescription:
      "按内容自动匹配，未经编辑挑选；已在相关技术和版本脉络里的不再重复。",
    viewSignal: "查看信号",
    autoMatched: "自动匹配",
    viewSkill: "查看技能",
    viewConcept: "查看概念",
    followUpEyebrow: "延伸思考",
    followUpHeading: "后续问题",
    appearancesEyebrow: "发布记录",
    appearancesHeading: "收录于",
    appearancesNote: (hasWeekly: boolean) =>
      `收录这条信号的技术简报，新的在前${hasWeekly ? "；最后一行是它那一周的周回顾" : ""}。标签是它在那一期所在的栏目。`,
    weeklyRow: (range: string) => `周回顾 · ${range}`,
    issueSections: { high_priority: "立即关注", watch: "值得跟踪" },
    sourceFoot: "来源参考",
    pagerLabel: "信号翻页",
    /** English site only: what on the page is written in Chinese. */
    chineseNote: { writeUp: "", notesOnly: "", chineseSource: "" }
  },
  evolution: {
    eyebrow: "版本脉络",
    headingLater: "这条信号已有后续",
    heading: "这条信号的版本脉络",
    leadLater: (later: number, latestTitle: string) =>
      `你正在读的是这条线上较早的一条，之后还有 ${later} 条，最新的是「${latestTitle}」。`,
    lead: "这是这条线上最新的一条，下面是它承接的早前信号。",
    current: "当前",
    latest: "最新"
  },
  source: {
    title: "来源",
    linkLabel: "打开原始来源"
  },
  related: {
    linkLabel: "查看相关信号"
  },
  pager: {
    previous: (unit: PagerUnit) => `← 上一${unit}`,
    next: (unit: PagerUnit) => `下一${unit} →`
  },
  ai: {
    disclaimer: "",
    failed: {
      explain: "解读生成失败，请稍后再试。",
      compare: "对比生成失败，请稍后再试。",
      learningPath: "学习路径生成失败，请稍后再试。"
    },
    pending: "生成中…",
    explain: {
      levels: {
        beginner: { label: "入门", description: "刚接触 AI 工程" },
        intermediate: { label: "进阶", description: "熟悉常见概念" },
        advanced: { label: "资深", description: "想要技术要点" }
      },
      eyebrow: "按你的水平解读",
      heading: "让 AI 按你的水平解读这个信号",
      lede: "选择你的经验水平，AI 会现场生成一份为这个水平定制的解读。",
      levelLabel: "选择经验水平",
      submit: "生成解读",
      explanation: "解读",
      analogy: "打个比方",
      keyPoints: "关键要点",
      nextSteps: "下一步建议"
    },
    compare: {
      eyebrow: "技术对比",
      heading: "对比另一项技术",
      lede: "选择另一项已发布技术，让 AI 现场生成一份相似点、差异点和适用场景的对比。",
      submit: "生成对比",
      similarities: "相似点",
      differences: "差异点",
      whenToPrefer: "各自适用场景",
      shared: "共同注意事项"
    },
    learningPath: {
      eyebrow: "怎么学起",
      heading: "让 AI 生成一条学习路径",
      lede: "基于本页的相关知识和相关技能，AI 会现场生成一条从基础到应用的学习路径。",
      submit: "生成学习路径",
      overview: "路径总览",
      steps: "学习步骤",
      checkpoints: "自测点"
    }
  }
};

const pagerNouns: Record<PagerUnit, { previous: string; next: string }> = {
  期: { previous: "Previous issue", next: "Next issue" },
  周: { previous: "Previous week", next: "Next week" },
  条: { previous: "Older signal", next: "Newer signal" }
};

const en: typeof zh = {
  page: {
    notFoundTitle: "Page not found",
    shellTitle: "Signal",
    shellDescription:
      "A published signal, its source, and the skills and knowledge that help explain it.",
    shellSectionLabel: "Published signal",
    defaultSkillNote: "This skill helps you evaluate the signal or act on it.",
    defaultKnowledgeNote: "This concept gives the background to the signal.",
    defaultTechnologyNote:
      "A neighbouring technology; follow the line to read on."
  },
  hero: {
    catalog: (type, date) => `${type} · ${date}`
  },
  aside: {
    priority: "Priority",
    difficulty: "Reading level"
  },
  sections: {
    bodyEyebrow: "Record",
    bodyHeading: "The signal",
    whyEyebrow: "Why now",
    whyHeading: "Why it matters",
    contextEyebrow: "Background",
    contextHeading: "Technical context",
    audienceEyebrow: "Audience",
    audienceHeading: "Who should care",
    impactAreas: "Areas it may affect",
    learningEyebrow: "Next",
    learningHeading: "Learning path",
    graphHeading: "Where it sits in the network",
    graphHint:
      "How this signal connects to neighbouring technologies, skills and background knowledge. Follow any link to keep exploring.",
    relatedTechnologies: "Related signals",
    relatedTechnologiesDescription:
      "Other technologies next to this signal in workflow or subject; follow the line to read on.",
    viewTechnology: "Open signal",
    similarHeading: "Similar signals",
    similarDescription:
      "Matched by content, not picked by an editor; those already under related signals or the release line are not repeated.",
    viewSignal: "Open signal",
    autoMatched: "Auto-matched",
    viewSkill: "Open skill",
    viewConcept: "Open concept",
    followUpEyebrow: "Further thought",
    followUpHeading: "Follow-up questions",
    appearancesEyebrow: "Publication record",
    appearancesHeading: "Featured in",
    appearancesNote: (hasWeekly) =>
      `The briefings that carried this signal, newest first${hasWeekly ? "; the last row is the weekly review of its week" : ""}. The tag is the section it ran in.`,
    weeklyRow: (range) => `Weekly review · ${range}`,
    issueSections: {
      high_priority: "Immediate attention",
      watch: "Worth tracking"
    },
    sourceFoot: "Sources",
    pagerLabel: "Signal pages",
    chineseNote: {
      writeUp:
        "The full write-up and the editors' notes are in Chinese; the summary above is from the original announcement.",
      notesOnly:
        "The editors' notes below — why it matters, the context, the learning path — are written in Chinese.",
      chineseSource:
        "This signal comes from a Chinese-language source and is written in Chinese."
    }
  },
  evolution: {
    eyebrow: "Release line",
    headingLater: "This signal has a follow-up",
    heading: "Release line",
    leadLater: (later, latestTitle) =>
      `You are reading an earlier release on this line. ${later} more ${later === 1 ? "release follows" : "releases follow"}; the latest is “${latestTitle}”.`,
    lead: "This is the latest release on the line; the earlier ones it follows are below.",
    current: "Current",
    latest: "Latest"
  },
  source: {
    title: "Source",
    linkLabel: "Open the original source"
  },
  related: {
    linkLabel: "Open signal"
  },
  pager: {
    previous: (unit) => `← ${pagerNouns[unit].previous}`,
    next: (unit) => `${pagerNouns[unit].next} →`
  },
  ai: {
    disclaimer:
      "AI-generated, not reviewed by an editor, for reference only. Answers are written in Chinese.",
    failed: {
      explain: "The explanation could not be generated; try again later.",
      compare: "The comparison could not be generated; try again later.",
      learningPath: "The learning path could not be generated; try again later."
    },
    pending: "Generating…",
    explain: {
      levels: {
        beginner: { label: "Beginner", description: "new to AI engineering" },
        intermediate: {
          label: "Intermediate",
          description: "familiar with the common ideas"
        },
        advanced: {
          label: "Advanced",
          description: "wants the technical points"
        }
      },
      eyebrow: "At your level",
      heading: "Have AI explain this signal at your level",
      lede: "Pick your level of experience and AI writes an explanation for it on the spot.",
      levelLabel: "Experience level",
      submit: "Explain",
      explanation: "Explanation",
      analogy: "An analogy",
      keyPoints: "Key points",
      nextSteps: "Next steps"
    },
    compare: {
      eyebrow: "Comparison",
      heading: "Compare with another technology",
      lede: "Pick another published technology and AI writes a comparison of what they share, how they differ and when to use each.",
      submit: "Compare",
      similarities: "Similarities",
      differences: "Differences",
      whenToPrefer: "When to use each",
      shared: "Shared considerations"
    },
    learningPath: {
      eyebrow: "Getting started",
      heading: "Have AI draft a learning path",
      lede: "From the related knowledge and skills on this page, AI drafts a path from the basics to applying it.",
      submit: "Draft a learning path",
      overview: "Overview",
      steps: "Steps",
      checkpoints: "Self-checks"
    }
  }
};

export const technologyDetailCopy: Record<Locale, typeof zh> = { zh, en };
