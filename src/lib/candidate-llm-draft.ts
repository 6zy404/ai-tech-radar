import { parseLlmJsonObject } from "@/lib/llm/output-sanitization";
import type {
  PublisherType,
  ReadingDifficulty,
  RelationType,
  SourceLanguage,
  TechnologyType
} from "@/types/content";

/**
 * 「AI 起草」: a model reads one candidate and its primary source and writes
 * the Chinese draft an editor would otherwise write by hand — title, summary,
 * body, the explanation fields, topic tags, and related knowledge and skills
 * with a relation type each.
 *
 * This file is the pure half: the prompt and the output validator. The I/O
 * (fetching the source, calling the model, converting, writing) lives in
 * `candidate-llm-draft-workflow.ts`.
 *
 * The prompt version is a code constant for the same reason as
 * `TRIAGE_PROMPT_VERSION`: a draft records which prompt wrote it, and a store
 * record could be edited after the fact.
 */
export const CANDIDATE_DRAFT_PROMPT_VERSION = "candidate-draft-v1";

export interface CandidateDraftInput {
  title: string;
  summary: string;
  content: string;
  sourceName: string;
  sourceUrl: string;
  publisherName: string;
  publishDate: string;
  sourceLanguage: SourceLanguage;
  /** The fetched page or release notes. */
  sourceText?: string;
  /** Why the source could not be read; the model then works from the
   *  candidate's own fields and is told so. */
  sourceTextError?: string;
}

export interface DraftCatalogEntry {
  id: string;
  title: string;
  summary: string;
}

export interface DraftCatalog {
  topics: { id: string; name: string; description: string }[];
  knowledge: DraftCatalogEntry[];
  skills: DraftCatalogEntry[];
}

export interface DraftRelation {
  id: string;
  relationType: RelationType;
  /** One sentence for the relation itself (the 附注 on the edge). */
  note?: string;
  /** One or two sentences for the signal page's related-item card. */
  explanation?: string;
}

export interface CandidateDraftFields {
  title: string;
  summary: string;
  content: string;
  slug?: string;
  type?: TechnologyType;
  publisherName?: string;
  publisherType?: PublisherType;
  whyItMatters?: string;
  whoShouldCare?: string[];
  technicalContext?: string;
  impactAreas?: string[];
  learningPath?: string[];
  followUpQuestions?: string[];
  readingDifficulty?: ReadingDifficulty;
  tags: string[];
  relatedKnowledge: DraftRelation[];
  relatedSkills: DraftRelation[];
}

export type ValidatedCandidateDraft =
  | { ok: true; fields: CandidateDraftFields; warnings: string[] }
  | { ok: false; error: string; warnings: string[] };

const technologyTypes: TechnologyType[] = [
  "platform",
  "tool",
  "model",
  "protocol",
  "workflow"
];
const publisherTypes: PublisherType[] = [
  "big-tech",
  "startup",
  "research-lab",
  "open-source-community",
  "media"
];
const readingDifficulties: ReadingDifficulty[] = [
  "beginner",
  "intermediate",
  "advanced"
];

/* The relation types the published graph actually uses between a signal and
   a knowledge item or a skill (measured 2026-10-13 over the override store:
   knowledge explains 177 / supports 106 / uses 65 / requires 61 / builds-on
   19 / extends 13; skill supports 203 / requires 73 / uses 68 / extends 31).
   Anything else is replaced by the kind's most common type. */
export const draftRelationTypes: Record<"knowledge" | "skill", RelationType[]> =
  {
    knowledge: [
      "explains",
      "supports",
      "uses",
      "requires",
      "builds-on",
      "extends"
    ],
    skill: ["supports", "requires", "uses", "extends"]
  };

const defaultRelationType: Record<"knowledge" | "skill", RelationType> = {
  knowledge: "explains",
  skill: "supports"
};

export const DRAFT_LIMITS = {
  title: 60,
  summary: 320,
  content: 8000,
  whyItMatters: 400,
  technicalContext: 600,
  listItem: 160,
  audienceItem: 60,
  impactItem: 30,
  note: 80,
  explanation: 200,
  tags: 4,
  relatedPerKind: 4
} as const;

const SOURCE_TEXT_PROMPT_CHARS = 12000;

const allowedFields = new Set([
  "title",
  "summary",
  "content",
  "slug",
  "type",
  "publisherName",
  "publisherType",
  "whyItMatters",
  "whoShouldCare",
  "technicalContext",
  "impactAreas",
  "learningPath",
  "followUpQuestions",
  "readingDifficulty",
  "tags",
  "relatedKnowledge",
  "relatedSkills",
  "limitations"
]);

function clip(value: string, limit: number): string {
  const text = value.replace(/\s+/g, " ").trim();

  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function describeCatalog(catalog: DraftCatalog): string {
  const topics = catalog.topics
    .map(
      (topic) => `- ${topic.id}｜${topic.name}｜${clip(topic.description, 60)}`
    )
    .join("\n");
  const knowledge = catalog.knowledge
    .map((item) => `- ${item.id}｜${item.title}｜${clip(item.summary, 70)}`)
    .join("\n");
  const skills = catalog.skills
    .map((item) => `- ${item.id}｜${item.title}｜${clip(item.summary, 70)}`)
    .join("\n");

  return `## 可用的话题（tags 只能从这里选 id）\n\n${topics}\n\n## 已发布的背景知识（relatedKnowledge 只能从这里选 id）\n\n${knowledge}\n\n## 已发布的技能（relatedSkills 只能从这里选 id）\n\n${skills}`;
}

const rubric = `你是一个中文技术雷达站的编辑。这个站只发布「值得工程团队优先关注的新技术信号」，每条信号都要讲清楚发生了什么、为什么重要、需要什么背景。现在请你根据一条导入的候选和它的原文，写出这条信号的中文稿。编辑会在工作台里核对后再发布。

## 事实

- 只写原文里有的事实与数字。原文没说的不要补，不确定的不要写；宁可短，不要编。
- 原文取不到时，只能根据给出的标题与摘要写，正文要短，并在 limitations 里说明。
- 发布方（publisherName）是发布这项成果的机构或项目，不是转载它的媒体或订阅源，也不是提交 release 的个人账号。例如量子位报道的字节论文，发布方是「字节跳动 Seed」；vLLM 的 release，发布方是「vLLM」。
- publisherType 五选一：big-tech / startup / research-lab / open-source-community / media。
- type 五选一，看这条信号的主体是什么：model（模型或权重）/ tool（库、引擎、开发工具）/ platform（云服务、产品平台）/ protocol（协议、规范、接口标准）/ workflow（方法、流程、工程实践、评测方法）。

## 文字

- 全部用简体中文。约定俗成的技术词（token、checkpoint、API、GPU、benchmark 名称、产品名、模型名）保留原文，普通英文单词要译出来。
- 引号用「」，不用 "" 或 “”。
- 中文与英文、数字之间加一个空格，例如「OpenAI 放出 722 篇手稿」。
- 标题（title）：一句话说清是什么、有什么数字或变化，18 到 36 个字，不加书名号，不用标点结尾，不用 Markdown。
- 摘要（summary）：80 到 200 字，纯文本，不用 Markdown，写清主体、关键数字和与以往的不同。
- 正文（content）：400 到 1500 字。只能用这几种写法：「## 小标题」单独一行、段落、**加粗**、\`行内代码\`、有序列表（1. ）、无序列表（- ）。段落之间空一行。
  - 不要用表格、引用（>）、代码块、链接、图片、一级或三级标题。
  - 加粗与行内代码不能嵌套：不要写 **\`x\`**，写 \`x\` 就够了。
  - 常用结构：## 发生了什么 / ## 具体内容（数字、版本、许可）/ ## 与以往相比 / ## 对读者意味着什么（有序列表，2 到 3 条）。按原文实际内容取舍，不必每节都有。

## 解释字段

- whyItMatters：2 到 3 句，为什么工程团队应该关注，不要空话。
- whoShouldCare：2 到 4 条，具体到人群与场景。
- technicalContext：2 到 4 句，解释读懂这条信号需要的概念。
- impactAreas：2 到 4 个短词。
- learningPath：3 到 4 步，每步一句完整的话，写清做什么、为了弄懂什么，例如「先读《评估闭环》，弄清 Arena 名次与自己任务上的表现为什么会不一致」。不要只写一个标题。
- followUpQuestions：2 到 3 个读者可以带着去验证的问题。
- readingDifficulty：beginner / intermediate / advanced。

## 话题、知识、技能

- tags：从下面的话题里选 2 到 4 个 id。优先选细的话题（例如 tag-open-weights、tag-coding-agents、tag-agent-infra、tag-efficient-inference、tag-benchmarks、tag-training、tag-model-pricing、tag-ai-for-science、tag-ai-safety）；tag-ai-agents、tag-frontier-models、tag-inference 这三个宽话题只在确实没有更细的可选时才用，不要只给这三个。
- relatedKnowledge：从下面的知识里选 1 到 4 个真正能帮读者看懂这条信号的。每项给 id、relationType、note、explanation。
  - relationType 从 explains（这个概念解释了这条信号）/ supports（这条信号是这个概念的实例或证据）/ uses / requires（读这条信号前必须先懂它）/ builds-on / extends 里选。
- relatedSkills：从下面的技能里选 1 到 4 个读者可以拿来评估或应用这条信号的，要和这条信号的主题直接相关（例如图像模型不要配科研证据核查类的技能）。relationType 从 supports / requires / uses / extends 里选。
- note：一句话（不超过 40 字），写这条信号与该条目的具体联系，要带上这条信号自己的事实；explanation：一到两句，给信号页的关联卡片用。
- 只能用下面列出的 id，不要自己造。没有合适的就少选，不要凑数。

## 其他

- slug：英文小写加连字符，3 到 6 个词，概括主体，例如 cloudflare-clef-decision-models。
- limitations：0 到 3 条，说明原文缺了什么、哪些地方编辑需要核对。

只输出一个 JSON 对象，字段为：title, summary, content, slug, type, publisherName, publisherType, whyItMatters, whoShouldCare, technicalContext, impactAreas, learningPath, followUpQuestions, readingDifficulty, tags, relatedKnowledge, relatedSkills, limitations。relatedKnowledge 与 relatedSkills 是 [{"id":"…","relationType":"…","note":"…","explanation":"…"}] 形式的数组。`;

export function buildCandidateDraftSystemPrompt(catalog: DraftCatalog): string {
  return `${rubric}\n\n${describeCatalog(catalog)}`;
}

/** The first line doubles as the mock provider's routing key. */
export function buildCandidateDraftUserPrompt(
  input: CandidateDraftInput
): string {
  const lines = [
    "Purpose: candidate_draft",
    "",
    `标题: ${clip(input.title, 300)}`,
    `订阅源: ${input.sourceName}`,
    `订阅源记录的发布方: ${input.publisherName || "未知"}`,
    `链接: ${input.sourceUrl}`,
    `发布日期: ${input.publishDate || "未知"}`,
    `原文语言: ${input.sourceLanguage === "zh" ? "中文" : "英文"}`,
    `订阅源摘要: ${input.summary ? clip(input.summary, 1200) : "（没有）"}`
  ];

  if (input.content && input.content.trim() !== input.summary.trim()) {
    lines.push(`订阅源正文: ${clip(input.content, 3000)}`);
  }

  lines.push("");

  if (input.sourceText) {
    lines.push(
      `原文（已抓取）:\n${input.sourceText.slice(0, SOURCE_TEXT_PROMPT_CHARS)}`
    );
  } else {
    lines.push(
      `原文: （取不到：${input.sourceTextError ?? "未知原因"}。只能根据上面的标题和订阅源内容写，正文要短，并在 limitations 里说明。）`
    );
  }

  return lines.join("\n");
}

// --- output cleaning ---------------------------------------------------------

const CJK = /[㐀-鿿]/;

/** ASCII and curly double quotes around Chinese text become 「」. */
export function toChineseQuotes(text: string): string {
  return text
    .replace(/“([^”\n]+)”/g, "「$1」")
    .replace(/"([^"\n]+)"/g, (match, inner: string) =>
      CJK.test(inner) ? `「${inner}」` : match
    );
}

/** For fields rendered as plain strings: no Markdown markers survive. */
export function toPlainText(text: string): string {
  return toChineseQuotes(
    text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^#+\s*/gm, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function plainField(
  value: unknown,
  limit: number,
  name: string,
  warnings: string[]
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const text = toPlainText(value);

  if (!text) {
    return undefined;
  }

  if (text.length > limit) {
    warnings.push(`${name} 超过 ${limit} 字，已截断。`);
    return `${text.slice(0, limit - 1)}…`;
  }

  return text;
}

function plainList(
  value: unknown,
  maxItems: number,
  itemLimit: number
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => toPlainText(item))
    .filter(Boolean)
    .map((item) =>
      item.length > itemLimit ? `${item.slice(0, itemLimit - 1)}…` : item
    )
    .slice(0, maxItems);

  return items.length > 0 ? items : undefined;
}

/**
 * Rewrites a body into the subset `ContentBody` renders (`content-body.ts`):
 * `##` headings, paragraphs, `**bold**`, inline code, and lists. Everything
 * the playbook records as having reached readers verbatim — blockquotes,
 * tables, fenced code, nested inline markers — is rewritten or dropped here,
 * with a warning so the editor knows.
 */
export function cleanDraftBody(raw: string, warnings: string[]): string {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let inFence = false;
  let droppedFence = false;
  let droppedTable = false;
  let rewroteQuote = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      droppedFence = true;
      continue;
    }

    if (inFence) {
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      droppedTable = true;
      continue;
    }

    let next = line;

    if (/^\s*>/.test(next)) {
      next = next.replace(/^\s*>\s?/, "");
      rewroteQuote = true;
    }

    next = next
      .replace(/^\s*#{1,6}\s+/, "## ")
      .replace(/^\s*[*+]\s+/, "- ")
      .replace(/^\s*-\s+/, "- ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\*\*`([^`]+)`\*\*/g, "`$1`")
      .replace(/`\*\*([^*]+)\*\*`/g, "`$1`");

    out.push(toChineseQuotes(next));
  }

  if (droppedFence) {
    warnings.push("正文里的代码块不受支持，已删除。");
  }

  if (droppedTable) {
    warnings.push("正文里的表格不受支持，已删除；如需数字对比请改写成列表。");
  }

  if (rewroteQuote) {
    warnings.push("正文里的引用块已改成普通段落。");
  }

  let body = out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (body.length > DRAFT_LIMITS.content) {
    const cut = body.lastIndexOf("\n\n", DRAFT_LIMITS.content);
    body = body.slice(0, cut > 0 ? cut : DRAFT_LIMITS.content).trim();
    warnings.push(`正文超过 ${DRAFT_LIMITS.content} 字，已在段落处截断。`);
  }

  return body;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeDraftSlug(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72)
    .replace(/-$/, "");

  return slug.length >= 3 && SLUG_PATTERN.test(slug) ? slug : undefined;
}

function pickEnum<T extends string>(
  value: unknown,
  options: T[]
): T | undefined {
  return typeof value === "string" &&
    (options as string[]).includes(value.trim())
    ? (value.trim() as T)
    : undefined;
}

function sanitizeRelations(
  value: unknown,
  kind: "knowledge" | "skill",
  allowedIds: Set<string>,
  warnings: string[]
): DraftRelation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const label = kind === "knowledge" ? "知识" : "技能";
  const seen = new Set<string>();
  const relations: DraftRelation[] = [];

  for (const item of value) {
    const record =
      typeof item === "string"
        ? { id: item }
        : item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : undefined;
    const id = typeof record?.id === "string" ? record.id.trim() : "";

    if (!id) {
      continue;
    }

    if (!allowedIds.has(id)) {
      warnings.push(`模型给的${label} id「${id}」不存在或未发布，已丢弃。`);
      continue;
    }

    if (seen.has(id) || relations.length >= DRAFT_LIMITS.relatedPerKind) {
      continue;
    }

    seen.add(id);

    let relationType = pickEnum(record?.relationType, draftRelationTypes[kind]);

    if (!relationType) {
      relationType = defaultRelationType[kind];

      if (record?.relationType !== undefined) {
        warnings.push(
          `${label}「${id}」的关系类型「${String(record.relationType)}」不可用，已改为 ${relationType}。`
        );
      }
    }

    const note = plainField(
      record?.note,
      DRAFT_LIMITS.note,
      `${label}附注`,
      warnings
    );
    const explanation = plainField(
      record?.explanation,
      DRAFT_LIMITS.explanation,
      `${label}说明`,
      warnings
    );

    relations.push({
      id,
      relationType,
      ...(note ? { note } : {}),
      ...(explanation ? { explanation } : {})
    });
  }

  return relations;
}

/**
 * Parses and cleans the model's answer. Strict on what a draft cannot do
 * without (a Chinese title, summary and body) and on ids (any id not in the
 * catalog is dropped, with a warning); lenient on the rest (an unknown enum
 * value is left for the conversion default, an overlong string is cut).
 */
export function validateCandidateDraftOutput(
  rawText: string,
  catalog: DraftCatalog
): ValidatedCandidateDraft {
  const parsed = parseLlmJsonObject(rawText, allowedFields);

  if (!parsed.ok) {
    return { ok: false, error: parsed.error, warnings: [] };
  }

  const { record } = parsed;
  const warnings = [...parsed.warnings];
  const title = plainField(record.title, DRAFT_LIMITS.title, "标题", warnings);
  const summary = plainField(
    record.summary,
    DRAFT_LIMITS.summary,
    "摘要",
    warnings
  );
  const content =
    typeof record.content === "string"
      ? cleanDraftBody(record.content, warnings)
      : "";

  const missing = [
    title ? "" : "标题",
    summary ? "" : "摘要",
    content ? "" : "正文"
  ].filter(Boolean);

  if (missing.length > 0) {
    return {
      ok: false,
      error: `模型的输出缺少${missing.join("、")}。`,
      warnings
    };
  }

  const topicIds = new Set(catalog.topics.map((topic) => topic.id));
  const tags: string[] = [];

  for (const tag of Array.isArray(record.tags) ? record.tags : []) {
    if (typeof tag !== "string") continue;

    const id = tag.trim();

    if (!topicIds.has(id)) {
      warnings.push(`模型给的话题 id「${id}」不存在，已丢弃。`);
      continue;
    }

    if (!tags.includes(id) && tags.length < DRAFT_LIMITS.tags) {
      tags.push(id);
    }
  }

  const fields: CandidateDraftFields = {
    title: title as string,
    summary: summary as string,
    content,
    tags,
    relatedKnowledge: sanitizeRelations(
      record.relatedKnowledge,
      "knowledge",
      new Set(catalog.knowledge.map((item) => item.id)),
      warnings
    ),
    relatedSkills: sanitizeRelations(
      record.relatedSkills,
      "skill",
      new Set(catalog.skills.map((item) => item.id)),
      warnings
    )
  };

  const slug = normalizeDraftSlug(record.slug);
  const type = pickEnum(record.type, technologyTypes);
  const publisherName = plainField(
    record.publisherName,
    60,
    "发布方",
    warnings
  );
  const publisherType = pickEnum(record.publisherType, publisherTypes);
  const whyItMatters = plainField(
    record.whyItMatters,
    DRAFT_LIMITS.whyItMatters,
    "为什么重要",
    warnings
  );
  const technicalContext = plainField(
    record.technicalContext,
    DRAFT_LIMITS.technicalContext,
    "技术背景",
    warnings
  );
  const whoShouldCare = plainList(
    record.whoShouldCare,
    4,
    DRAFT_LIMITS.audienceItem
  );
  const impactAreas = plainList(record.impactAreas, 4, DRAFT_LIMITS.impactItem);
  const learningPath = plainList(record.learningPath, 5, DRAFT_LIMITS.listItem);
  const followUpQuestions = plainList(
    record.followUpQuestions,
    4,
    DRAFT_LIMITS.listItem
  );
  const readingDifficulty = pickEnum(
    record.readingDifficulty,
    readingDifficulties
  );

  if (slug) fields.slug = slug;
  if (type) fields.type = type;
  if (publisherName) fields.publisherName = publisherName;
  if (publisherType) fields.publisherType = publisherType;
  if (whyItMatters) fields.whyItMatters = whyItMatters;
  if (technicalContext) fields.technicalContext = technicalContext;
  if (whoShouldCare) fields.whoShouldCare = whoShouldCare;
  if (impactAreas) fields.impactAreas = impactAreas;
  if (learningPath) fields.learningPath = learningPath;
  if (followUpQuestions) fields.followUpQuestions = followUpQuestions;
  if (readingDifficulty) fields.readingDifficulty = readingDifficulty;

  const limitations = plainList(record.limitations, 3, DRAFT_LIMITS.listItem);

  if (limitations) {
    warnings.push(...limitations.map((item) => `模型注明：${item}`));
  }

  return { ok: true, fields, warnings };
}
