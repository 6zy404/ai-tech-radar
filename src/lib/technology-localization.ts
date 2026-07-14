import type {
  ImportanceLevel,
  LocalizedText,
  PublisherType,
  RelationType,
  SourceLanguage,
  TechnologyItem,
  TechnologyStatus,
  TechnologyType
} from "@/types/content";

export type TechnologyContentMode = "zh" | "original";
export type TechnologyContentContext = "preview" | "detail";
export type TechnologyTranslationCoverage =
  "not_needed" | "full" | "partial" | "none";

interface TechnologyDetailCopy {
  switchLabel: string;
  detailHeading: string;
  whyItMattersLabel: string;
  languageStateLabel: string;
  tagsLabel: string;
  sourceTitle: string;
  sourceNameLabel: string;
  sourceLinkLabel: string;
  publisherTitle: string;
  publisherNameLabel: string;
  publisherTypeLabel: string;
  publishedLabel: string;
  importanceLabel: string;
  relatedSkillsTitle: string;
  relatedSkillsDescription: string;
  relatedSkillsEmpty: string;
  relatedKnowledgeTitle: string;
  relatedKnowledgeDescription: string;
  relatedKnowledgeEmpty: string;
}

const technologyContextFields: Record<
  TechnologyContentContext,
  Array<keyof Pick<TechnologyItem, "title" | "summary" | "content">>
> = {
  preview: ["title", "summary"],
  detail: ["title", "summary", "content"]
};

const technologyRelationNoteTranslations: Record<string, string> = {
  "Protocol layers make tool use more explicit and portable.":
    "协议层让工具调用方式更明确，也更容易迁移。",
  "Stable contracts reduce fragile one-off integrations.":
    "稳定契约可以减少脆弱的一次性集成。",
  "Teams still need disciplined tool wrappers and ownership.":
    "团队仍然需要规范的工具封装和清晰的责任归属。",
  "Browser actions are visible and risky enough to need review checkpoints.":
    "浏览器操作可见且带风险，因此需要审核检查点。",
  "Narrow pilots reveal where browser agents help versus where they are brittle.":
    "小范围试点更容易看清浏览器代理在哪些地方有帮助、在哪些地方仍然脆弱。",
  "The value of edge models depends on matching constraints to capability.":
    "边缘模型的价值取决于是否把约束条件和能力匹配起来。",
  "Local deployment choices are only useful when quality tradeoffs are measured.":
    "只有先衡量质量取舍，本地部署选择才真正有意义。",
  "Evaluation only makes sense when the retrieval pipeline is understood first.":
    "只有先理解检索链路，评测才真正有意义。",
  "Dashboards make invisible quality loops concrete for teams.":
    "看板能把原本不易察觉的质量循环具体地展示给团队。",
  "Good tooling shortens the path from a failed answer to a retrieval fix.":
    "好的工具会缩短从失败回答到检索修复之间的路径。",
  "Workbenches are most useful when the underlying workflow is already structured.":
    "当底层流程已经结构化之后，工作台平台的价值会更明显。",
  "Fast screenshot-to-change feedback tightens team learning cycles.":
    "从截图到修改的快速反馈会缩短团队学习周期。",
  "Multimodal inputs help teams explain issues with less back-and-forth.":
    "多模态输入能帮助团队用更少的来回沟通把问题说清楚。",
  "Structured relationships give graph-backed assistants their main advantage.":
    "结构化关系正是图谱型助手最主要的优势来源。",
  "Graph structure can complement simpler retrieval workflows.":
    "图结构可以补强更简单的检索工作流。",
  "Voice systems surface latency problems in a user-visible way.":
    "语音系统会把延迟问题直接暴露在用户体验层面。",
  "Voice products raise the bar for clarity and interaction review.":
    "语音产品会进一步提高表达清晰度和交互审核的要求。",
  "This skill is linked directly from the technology record.":
    "这个技能是从技术条目中直接关联出来的。",
  "This knowledge item gives background for the technology signal.":
    "这个知识条目为当前技术信号提供背景。",
  "This skill helps evaluate or act on the technology signal.":
    "这个技能可以帮助评估或落地这条技术信号。",
  "This knowledge item gives background for understanding the signal.":
    "这个知识条目可以帮助理解这条技术信号的背景。",
  "Linked in the content relationship model.": "这个关联来自当前内容关系模型。"
};

function normalizeText(value?: string): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

export function hasLocalizedText(
  value: LocalizedText,
  language: "zh" | "en"
): boolean {
  return Boolean(normalizeText(value[language]));
}

export function hasTechnologyChineseContent(item: TechnologyItem): boolean {
  if (item.sourceLanguage === "zh") {
    return true;
  }

  return [item.title, item.summary, item.content].some((field) =>
    hasLocalizedText(field, "zh")
  );
}

export function hasTechnologyChineseContentForContext(
  item: TechnologyItem,
  context: TechnologyContentContext
): boolean {
  if (item.sourceLanguage === "zh") {
    return true;
  }

  return technologyContextFields[context].every((field) =>
    hasLocalizedText(item[field], "zh")
  );
}

export function getTechnologyTranslationCoverage(
  item: TechnologyItem,
  context: TechnologyContentContext
): TechnologyTranslationCoverage {
  if (item.sourceLanguage === "zh") {
    return "not_needed";
  }

  const fieldStatuses = technologyContextFields[context].map((field) =>
    hasLocalizedText(item[field], "zh")
  );

  if (fieldStatuses.every(Boolean)) {
    return "full";
  }

  if (fieldStatuses.some(Boolean)) {
    return "partial";
  }

  return "none";
}

export function getTechnologyTypeLabel(
  type: TechnologyType,
  mode: TechnologyContentMode
): string {
  if (mode === "original") {
    return type;
  }

  const labels: Record<TechnologyType, string> = {
    platform: "平台",
    tool: "工具",
    model: "模型",
    protocol: "协议",
    workflow: "工作流"
  };

  return labels[type];
}

export function getPublisherTypeLabel(
  publisherType: PublisherType,
  mode: TechnologyContentMode
): string {
  if (mode === "original") {
    return publisherType;
  }

  const labels: Record<PublisherType, string> = {
    "big-tech": "大型科技公司",
    startup: "创业公司",
    "research-lab": "研究实验室",
    "open-source-community": "开源社区",
    media: "媒体"
  };

  return labels[publisherType];
}

export function getImportanceLevelLabel(
  importanceLevel: ImportanceLevel,
  mode: TechnologyContentMode
): string {
  if (mode === "original") {
    return importanceLevel;
  }

  const labels: Record<ImportanceLevel, string> = {
    signal: "信号级",
    important: "重要",
    critical: "关键"
  };

  return labels[importanceLevel];
}

export function getTechnologySignalLabel(
  importanceLevel: ImportanceLevel,
  mode: TechnologyContentMode
): string {
  const originalLabels: Record<ImportanceLevel, string> = {
    signal: "Early signal",
    important: "Worth tracking",
    critical: "Critical signal"
  };

  if (mode === "original") {
    return originalLabels[importanceLevel];
  }

  const labels: Record<ImportanceLevel, string> = {
    signal: "早期观察",
    important: "值得跟进",
    critical: "关键信号"
  };

  return labels[importanceLevel];
}

export function getTechnologyAudienceLabel(
  type: TechnologyType,
  mode: TechnologyContentMode
): string {
  const originalLabels: Record<TechnologyType, string> = {
    platform: "For platform, product, and technical strategy teams",
    tool: "For engineering productivity and quality teams",
    model: "For AI product, edge, and architecture teams",
    protocol: "For platform engineers and AI tooling owners",
    workflow: "For automation, operations, and product teams"
  };

  if (mode === "original") {
    return originalLabels[type];
  }

  const labels: Record<TechnologyType, string> = {
    platform: "适合平台、产品和技术策略团队关注",
    tool: "适合工程效率和质量团队关注",
    model: "适合 AI 产品、端侧和架构团队关注",
    protocol: "适合平台工程和 AI 工具体系负责人关注",
    workflow: "适合自动化、运营和产品团队关注"
  };

  return labels[type];
}

export function getTechnologyStatusLabel(
  status: TechnologyStatus,
  mode: TechnologyContentMode
): string {
  if (mode === "original") {
    return status;
  }

  const labels: Record<TechnologyStatus, string> = {
    draft: "草稿",
    published: "已发布",
    archived: "已归档"
  };

  return labels[status];
}

export function getRelationTypeLabel(
  relationType: RelationType,
  mode: TechnologyContentMode
): string {
  if (mode === "original") {
    return relationType;
  }

  const labels: Record<RelationType, string> = {
    "builds-on": "渊源",
    uses: "借助",
    explains: "释义",
    requires: "必备",
    extends: "延伸",
    supports: "印证",
    "related-to": "关联"
  };

  return labels[relationType];
}

export function getTechnologyRelationNote(
  note: string,
  mode: TechnologyContentMode
): string {
  if (mode === "original") {
    return note;
  }

  return technologyRelationNoteTranslations[note] ?? note;
}

export function getTechnologyDefaultMode(
  item: TechnologyItem,
  context: TechnologyContentContext = "detail"
): TechnologyContentMode {
  return hasTechnologyChineseContentForContext(item, context)
    ? "zh"
    : "original";
}

export function getEffectiveTechnologyMode(
  item: TechnologyItem,
  requestedMode: TechnologyContentMode,
  context: TechnologyContentContext
): TechnologyContentMode {
  if (requestedMode === "original") {
    return "original";
  }

  return hasTechnologyChineseContentForContext(item, context)
    ? "zh"
    : "original";
}

export function getLocalizedTechnologyText(
  value: LocalizedText,
  mode: TechnologyContentMode,
  sourceLanguage: SourceLanguage
): string {
  if (mode === "zh") {
    return normalizeText(value.zh) ?? value.original;
  }

  if (mode === "original") {
    return value.original;
  }

  return sourceLanguage === "zh"
    ? (normalizeText(value.zh) ?? value.original)
    : value.original;
}

export function getPreferredTechnologyText(
  value: LocalizedText,
  sourceLanguage: SourceLanguage
): string {
  return getLocalizedTechnologyText(
    value,
    sourceLanguage === "zh" || hasLocalizedText(value, "zh")
      ? "zh"
      : "original",
    sourceLanguage
  );
}

export function getPreferredTechnologyTitle(item: TechnologyItem): string {
  return getPreferredTechnologyText(item.title, item.sourceLanguage);
}

export function getPreferredTechnologySummary(item: TechnologyItem): string {
  return getPreferredTechnologyText(item.summary, item.sourceLanguage);
}

export function getTechnologySearchText(item: TechnologyItem): string {
  return [
    item.title.original,
    item.title.zh,
    item.summary.original,
    item.summary.zh,
    item.content.original,
    item.content.zh
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getTechnologyModeLabel(mode: TechnologyContentMode): string {
  return mode === "zh" ? "中文" : "Original";
}

export function getTechnologyDisplayLabel(
  mode: TechnologyContentMode,
  context: TechnologyContentContext
): string {
  if (context === "preview") {
    return mode === "zh" ? "中文预览" : "Original preview";
  }

  return mode === "zh" ? "当前显示中文" : "Current view Original";
}

export function getTechnologySourceLanguageLabel(
  item: TechnologyItem,
  context: TechnologyContentContext,
  mode: TechnologyContentMode
): string {
  if (mode === "original") {
    if (context === "preview") {
      return item.sourceLanguage === "zh" ? "Source ZH" : "Source EN";
    }

    return item.sourceLanguage === "zh"
      ? "Source language ZH"
      : "Source language EN";
  }

  if (context === "preview") {
    return item.sourceLanguage === "zh" ? "原始 ZH" : "原始 EN";
  }

  return item.sourceLanguage === "zh" ? "原始语言 ZH" : "原始语言 EN";
}

export function getTechnologyTranslationCoverageLabel(
  coverage: TechnologyTranslationCoverage,
  mode: TechnologyContentMode
): string {
  if (mode === "original") {
    switch (coverage) {
      case "not_needed":
        return "Source is Chinese";
      case "full":
        return "Chinese ready";
      case "partial":
        return "Chinese partial";
      case "none":
      default:
        return "Chinese unavailable";
    }
  }

  switch (coverage) {
    case "not_needed":
      return "原文即中文";
    case "full":
      return "中文完整";
    case "partial":
      return "中文部分可用";
    case "none":
    default:
      return "暂无中文";
  }
}

export function getTechnologySwitchLabel(
  scope: "home" | "list" | "detail"
): string {
  const labels = {
    home: "卡片语言",
    list: "列表语言",
    detail: "阅读语言"
  };

  return labels[scope];
}

export function getTechnologyDetailCopy(
  mode: TechnologyContentMode
): TechnologyDetailCopy {
  if (mode === "original") {
    return {
      switchLabel: "Reading language",
      detailHeading: "Why this matters",
      whyItMattersLabel: "Signal focus",
      languageStateLabel: "Language state",
      tagsLabel: "Tags",
      sourceTitle: "Original source",
      sourceNameLabel: "Source name",
      sourceLinkLabel: "Open original source",
      publisherTitle: "Publisher",
      publisherNameLabel: "Publisher",
      publisherTypeLabel: "Publisher type",
      publishedLabel: "Published",
      importanceLabel: "Importance",
      relatedSkillsTitle: "Skills to act on this signal",
      relatedSkillsDescription:
        "Use these capabilities to evaluate, pilot, or operationalize the signal.",
      relatedSkillsEmpty: "No skill path has been linked for this item.",
      relatedKnowledgeTitle: "Knowledge to understand it",
      relatedKnowledgeDescription:
        "Review these concepts first if the signal depends on unfamiliar foundations.",
      relatedKnowledgeEmpty:
        "No knowledge background has been linked for this item."
    };
  }

  return {
    switchLabel: "阅读语言",
    detailHeading: "为什么值得关注",
    whyItMattersLabel: "信号重点",
    languageStateLabel: "语言状态",
    tagsLabel: "主题标签",
    sourceTitle: "原始来源",
    sourceNameLabel: "来源名称",
    sourceLinkLabel: "打开原始来源",
    publisherTitle: "发布方信息",
    publisherNameLabel: "发布方",
    publisherTypeLabel: "发布方类型",
    publishedLabel: "发布日期",
    importanceLabel: "重要程度",
    relatedSkillsTitle: "理解路径：相关技能",
    relatedSkillsDescription:
      "这些能力可以帮助你评估、试点或落地这条技术信号。",
    relatedSkillsEmpty: "当前条目还没有关联技能路径。",
    relatedKnowledgeTitle: "理解路径：背景知识",
    relatedKnowledgeDescription:
      "如果这条信号依赖陌生概念，可以先从这些知识条目开始理解。",
    relatedKnowledgeEmpty: "当前条目还没有关联背景知识。"
  };
}

export function getTechnologyTranslationMessage(
  mode: TechnologyContentMode,
  hasAnyChinese: boolean,
  hasContextChinese: boolean
): string {
  if (!hasAnyChinese) {
    return mode === "original"
      ? "Chinese translation is not available yet. Original text is shown."
      : "暂无中文翻译，当前显示原文内容。";
  }

  if (!hasContextChinese) {
    return mode === "original"
      ? "Only the title or summary has Chinese translation so far. The detail page stays in the original language for consistency."
      : "当前只有中文标题或摘要，正文尚未完整翻译，因此详情页默认显示原文。";
  }

  return mode === "original"
    ? "Original text is shown. Switch back to Chinese at any time for easier reading."
    : "当前显示中文内容，便于快速阅读；需要核对时请参考原始来源。";
}
