import type {
  DifficultyLevel,
  HeatLevel,
  KnowledgeCategory,
  LearningCost,
  SkillType
} from "@/types/content";

// The allowed values and reader-facing labels of the skill and knowledge
// attributes. The workspace validates against the value lists and its
// select boxes list them in this order; every page, public or workspace,
// labels them from the maps below.

export const skillTypes: SkillType[] = [
  "engineering",
  "analysis",
  "product",
  "operations",
  "communication"
];
export const heatLevels: HeatLevel[] = ["emerging", "active", "hot"];
export const learningCosts: LearningCost[] = ["low", "medium", "high"];
export const knowledgeCategories: KnowledgeCategory[] = [
  "machine-learning",
  "software-architecture",
  "data",
  "product-thinking",
  "operations"
];
export const difficultyLevels: DifficultyLevel[] = [
  "foundation",
  "intermediate",
  "advanced"
];

export const skillTypeLabels: Record<SkillType, string> = {
  engineering: "工程落地",
  analysis: "评估与分析",
  product: "产品判断",
  operations: "运维与落地",
  communication: "团队沟通"
};

export const heatLabels: Record<HeatLevel, string> = {
  hot: "当前热门",
  active: "活跃",
  emerging: "新兴"
};

export const learningCostLabels: Record<LearningCost, string> = {
  low: "学习成本低",
  medium: "学习成本中等",
  high: "学习成本高"
};

// For places where a label already says 学习成本. Repeating it in the value
// reads as 学习成本 / 学习成本中等 — the same stutter removed from the
// knowledge cards on 2026-07-30.
export const learningCostValues: Record<LearningCost, string> = {
  low: "低",
  medium: "中等",
  high: "高"
};

export const knowledgeCategoryLabels: Record<KnowledgeCategory, string> = {
  "machine-learning": "机器学习",
  "software-architecture": "软件架构",
  data: "数据",
  "product-thinking": "产品思维",
  operations: "运维"
};

export const difficultyLabels: Record<DifficultyLevel, string> = {
  foundation: "基础",
  intermediate: "进阶",
  advanced: "高级"
};
