import type { Locale } from "@/lib/i18n/locale";
import type {
  DifficultyLevel,
  KnowledgeCategory,
  SkillType
} from "@/types/content";

/* Interface text of /skills and /knowledge and their shared filter box.
   See copy/shell.ts for the pattern. */

const zh = {
  filter: {
    matched: (match: number, total: number, unit: string) =>
      `筛出 ${match} / ${total} ${unit}`,
    noMatch: (noun: string, query: string) => `没有${noun}含「${query}」。`,
    searchSite: (query: string) => `到全站搜索找「${query}」`
  },
  relationLabel: "关联",
  skills: {
    title: "理解 AI 信号的技能",
    description:
      "用这些实用技能判断一个新的 AI 技术信号是否值得测试、跟踪，或向团队解释。",
    sectionLabel: "理解技能",
    sectionEyebrow: "技能方向",
    sections: {
      engineering: {
        title: "工程落地",
        focus: "当某个信号可能改变团队的构建或交付方式时，使用这些技能。"
      },
      analysis: {
        title: "评估与分析",
        focus: "用这些技能把持久的信号与一时的噪声区分开。"
      },
      product: {
        title: "产品判断",
        focus: "在把某项技术纳入路线图之前，使用这些技能。"
      },
      operations: {
        title: "运维与落地",
        focus: "当信号影响上线、可靠性或支持时，使用这些技能。"
      },
      communication: {
        title: "团队沟通",
        focus: "用这些技能帮助非专业人员理解技术变化。"
      }
    } as Record<SkillType, { title: string; focus: string }>,
    densityTechnologies: "技术",
    densityKnowledge: "背景知识",
    practiceWith: "用这些来练习",
    open: "查看技能",
    emptyEyebrow: "技能库",
    emptyTitle: "暂无技能。",
    emptyBody: "当已发布技能与用户端技术信号建立关联后，会在这里展示。",
    intro:
      "先从与你角色匹配的技能开始，再打开关联的技术信号和背景概念，理解这一变化在哪里重要。",
    statsLabel: "技能概览",
    statSkills: "已收录技能",
    statHot: "当前热门",
    statSignals: "关联已发布信号",
    statKnowledge: "关联背景概念",
    filterLabel: "筛选技能",
    filterPlaceholder: "按标题、摘要、标签或技能方向筛选",
    countUnit: "项技能",
    noun: "技能",
    chineseOnly: ""
  },
  knowledge: {
    title: "解读 AI 信号的知识",
    description: "帮助用户理解 AI 技术信号及其背景的概念。",
    sectionLabel: "背景知识",
    sections: {
      foundation: {
        title: "基础概念",
        description: "当技术信号涉及陌生术语或更早的技术思想时，从这里开始。"
      },
      intermediate: {
        title: "进阶模式",
        description: "用这些概念比较不同方案、权衡取舍和实现路径。"
      },
      advanced: {
        title: "高级背景",
        description: "当信号改变架构、数据或技术战略假设时，使用这些背景。"
      }
    } as Record<DifficultyLevel, { title: string; description: string }>,
    // The card renders these under a 帮助你理解 label, so they read as its
    // object. They each used to open with 帮助你… of their own, which printed
    // 帮助你理解帮助你理解… on the two that matched.
    outcomes: {
      "machine-learning": "模型行为、评估的局限，以及实际约束。",
      "software-architecture": "接口边界、系统权衡和集成风险。",
      data: "检索、时效、可信度和数据流方面的假设。",
      "product-thinking": "技术变化如何转化为有范围的产品与落地决策。",
      operations: "评审闭环、可观测性和上线纪律。"
    } as Record<KnowledgeCategory, string>,
    outcomeLabel: "帮助你理解",
    densityTechnologies: "技术",
    densitySkills: "技能",
    explainsSignals: "可解释信号",
    open: "查看概念",
    emptyEyebrow: "暂无概念",
    emptyTitle: "暂无知识概念。",
    emptyBody: "学习库填充后，已发布的背景概念会在这里展示。",
    intro:
      "当技术信号引用了你需要复习的概念时，使用本页。每个概念都会说明它澄清了什么，以及哪些已发布信号依赖于它。",
    statsLabel: "知识概览",
    statConcepts: "知识概念",
    statFoundation: "基础级条目",
    statSkills: "关联技能",
    statSignals: "关联已发布信号",
    filterLabel: "筛选概念",
    filterPlaceholder: "按标题、摘要、标签或类别筛选",
    countUnit: "个概念",
    noun: "概念",
    chineseOnly: ""
  }
};

const en: typeof zh = {
  filter: {
    matched: (match, total, unit) => `Showing ${match} of ${total} ${unit}`,
    noMatch: (noun, query) => `No ${noun} contains “${query}”. `,
    searchSite: (query) => `Search the whole site for “${query}”`
  },
  relationLabel: "Linked",
  skills: {
    title: "Skills for reading AI signals",
    description:
      "Practical skills for deciding whether a new AI technology signal is worth testing, tracking, or explaining to your team.",
    sectionLabel: "Skills",
    sectionEyebrow: "Skill area",
    sections: {
      engineering: {
        title: "Engineering",
        focus:
          "Use these when a signal may change how your team builds or ships."
      },
      analysis: {
        title: "Evaluation & analysis",
        focus: "Use these to tell a lasting signal from passing noise."
      },
      product: {
        title: "Product judgement",
        focus: "Use these before a technology goes onto the roadmap."
      },
      operations: {
        title: "Operations",
        focus:
          "Use these when a signal affects launches, reliability or support."
      },
      communication: {
        title: "Team communication",
        focus:
          "Use these to help non-specialists understand a technical change."
      }
    },
    densityTechnologies: "signals",
    densityKnowledge: "concepts",
    practiceWith: "Practise on",
    open: "Open skill",
    emptyEyebrow: "Skill library",
    emptyTitle: "No skills yet.",
    emptyBody:
      "Published skills appear here once they are linked to published signals.",
    intro:
      "Start with the skills that match your role, then open the linked signals and background concepts to see where the change matters.",
    statsLabel: "Skills at a glance",
    statSkills: "skills",
    statHot: "hot right now",
    statSignals: "linked published signals",
    statKnowledge: "linked concepts",
    filterLabel: "Filter skills",
    filterPlaceholder: "Filter by title, summary, tag or skill area",
    countUnit: "skills",
    noun: "skill",
    chineseOnly:
      "Skill entries are written in Chinese; signal titles are in English where the source is."
  },
  knowledge: {
    title: "Knowledge for reading AI signals",
    description:
      "Concepts that help you understand AI technology signals and their background.",
    sectionLabel: "Background knowledge",
    sections: {
      foundation: {
        title: "Foundations",
        description:
          "Start here when a signal uses an unfamiliar term or rests on an older idea."
      },
      intermediate: {
        title: "Intermediate patterns",
        description:
          "Use these to compare approaches, trade-offs and implementation paths."
      },
      advanced: {
        title: "Advanced background",
        description:
          "Use these when a signal changes assumptions about architecture, data or technical strategy."
      }
    },
    outcomes: {
      "machine-learning":
        "model behaviour, the limits of evaluation, and practical constraints.",
      "software-architecture":
        "interface boundaries, system trade-offs and integration risk.",
      data: "assumptions about retrieval, freshness, trust and data flow.",
      "product-thinking":
        "how a technical change turns into scoped product and rollout decisions.",
      operations: "review loops, observability and launch discipline."
    },
    outcomeLabel: "Helps you understand",
    densityTechnologies: "signals",
    densitySkills: "skills",
    explainsSignals: "Explains",
    open: "Open concept",
    emptyEyebrow: "No concepts yet",
    emptyTitle: "No knowledge concepts yet.",
    emptyBody:
      "Published background concepts appear here once the library is filled.",
    intro:
      "Use this page when a signal refers to a concept you need to brush up on. Each concept says what it clarifies and which published signals depend on it.",
    statsLabel: "Knowledge at a glance",
    statConcepts: "concepts",
    statFoundation: "foundation entries",
    statSkills: "linked skills",
    statSignals: "linked published signals",
    filterLabel: "Filter concepts",
    filterPlaceholder: "Filter by title, summary, tag or category",
    countUnit: "concepts",
    noun: "concept",
    chineseOnly:
      "Knowledge entries are written in Chinese; signal titles are in English where the source is."
  }
};

export const libraryCopy: Record<Locale, typeof zh> = { zh, en };
