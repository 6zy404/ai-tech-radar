import type {
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmProvider
} from "@/lib/llm/provider";

function extractPromptValue(prompt: string, label: string): string {
  const match = prompt.match(new RegExp(`${label}:\\s*(.+)`, "i"));

  return match?.[1]?.trim() ?? "";
}

function extractEmbeddedJsonTitle(prompt: string, label: string): string {
  const match = prompt.match(
    new RegExp(`${label}:[\\s\\S]*?"title":\\s*"([^"]+)"`, "i")
  );

  return match?.[1]?.trim() ?? label;
}

function createMockTechnologyComparisonResponse(
  request: LlmGenerateRequest
): LlmGenerateResponse {
  const titleA = extractEmbeddedJsonTitle(request.userPrompt, "Technology A");
  const titleB = extractEmbeddedJsonTitle(request.userPrompt, "Technology B");

  return {
    providerName: "mock",
    modelName: "mock-technology-comparison-v0",
    tokenUsage: {
      promptTokens: Math.ceil(request.userPrompt.length / 4),
      completionTokens: 140,
      totalTokens: Math.ceil(request.userPrompt.length / 4) + 140
    },
    text: JSON.stringify({
      similarities: [
        `${titleA} 和 ${titleB} 都在解决相邻工作流里的实际问题，而不是纯理论概念。`,
        "两者都需要团队先明确评估标准，再决定投入多少精力。"
      ],
      differences: [
        `${titleA} 更偏向解决当下具体的落地问题。`,
        `${titleB} 的适用范围和成熟度可能与前者不同，需要结合团队现状判断。`
      ],
      whenToPreferA: `当团队的首要目标更贴近 ${titleA} 所解决的场景时，优先评估它。`,
      whenToPreferB: `当团队的首要目标更贴近 ${titleB} 所解决的场景时，优先评估它。`,
      sharedConsiderations: [
        "本对比由本地 mock 模型生成，仅供参考，请结合原始来源自行判断。"
      ]
    })
  };
}

function createMockTechnologyExplanationResponse(
  request: LlmGenerateRequest
): LlmGenerateResponse {
  const title = extractEmbeddedJsonTitle(request.userPrompt, "Technology");
  const levelLine = extractPromptValue(request.userPrompt, "Reader level");
  const isBeginner = levelLine.startsWith("beginner");
  const isAdvanced = levelLine.startsWith("advanced");

  const explanation = isBeginner
    ? `${title} 可以理解为一种帮助团队解决具体工程问题的新工具或新方法。它之所以被关注，是因为它可能改变现有工作流里某个环节的做法。入门阶段不需要掌握全部细节，先弄清它解决什么问题、给谁用即可。`
    : isAdvanced
      ? `${title} 的核心价值在于它对现有工程链路的具体改动点和权衡取舍。评估时应关注它的接口边界、与现有栈的集成成本，以及在什么规模下收益开始超过维护开销。`
      : `${title} 是一个值得跟踪的技术信号：它针对一个真实的工程场景提出了新的做法。建议先对照自己团队的现状判断相关性，再决定是否投入时间做小范围验证。`;

  return {
    providerName: "mock",
    modelName: "mock-technology-explanation-v0",
    tokenUsage: {
      promptTokens: Math.ceil(request.userPrompt.length / 4),
      completionTokens: 120,
      totalTokens: Math.ceil(request.userPrompt.length / 4) + 120
    },
    text: JSON.stringify({
      explanation,
      keyPoints: [
        `先弄清 ${title} 解决的核心问题是什么。`,
        "对照团队现状判断这个信号与自己的相关性。",
        "结合原始来源交叉验证，再决定投入多少精力。"
      ],
      ...(isBeginner
        ? {
            analogy: `可以把 ${title} 想象成给现有工作流换上了一个更合适的零件——整体流程不变，但某个环节变得更顺畅。`
          }
        : {}),
      nextSteps: [
        "阅读原始来源，确认具体的变化点。",
        "浏览本页的相关知识和相关技能，补齐背景。"
      ]
    })
  };
}

function createMockTechnologyLearningPathResponse(
  request: LlmGenerateRequest
): LlmGenerateResponse {
  const title = extractEmbeddedJsonTitle(request.userPrompt, "Technology");
  const knowledgeLabel =
    "Related background knowledge \\(from the content graph\\)";
  const skillLabel = "Related skills \\(from the content graph\\)";
  const knowledgeTitle = extractEmbeddedJsonTitle(
    request.userPrompt,
    knowledgeLabel
  );
  const skillTitle = extractEmbeddedJsonTitle(request.userPrompt, skillLabel);
  const hasKnowledge = knowledgeTitle !== knowledgeLabel;
  const hasSkill = skillTitle !== skillLabel;

  const steps = [
    hasKnowledge
      ? `先补齐背景概念「${knowledgeTitle}」，理解 ${title} 建立在什么基础上。`
      : `先阅读 ${title} 的原始来源，弄清它解决的核心问题。`,
    `对照本页的「为什么重要」和「技术背景」，梳理 ${title} 与现有做法的差异。`,
    hasSkill
      ? `练习相关技能「${skillTitle}」，用它评估 ${title} 在自己场景下的适用性。`
      : `结合团队现状，列出评估 ${title} 时要回答的两三个具体问题。`,
    `做一个小范围验证或阅读一个真实案例，再决定投入多少精力跟进 ${title}。`
  ];

  return {
    providerName: "mock",
    modelName: "mock-technology-learning-path-v0",
    tokenUsage: {
      promptTokens: Math.ceil(request.userPrompt.length / 4),
      completionTokens: 160,
      totalTokens: Math.ceil(request.userPrompt.length / 4) + 160
    },
    text: JSON.stringify({
      overview: `这条路径帮助你从背景概念出发，逐步建立对 ${title} 的判断力：先懂它建立在什么之上，再评估它对自己的实际价值。`,
      steps,
      checkpoints: [
        `能用一句话说清 ${title} 解决什么问题、给谁用。`,
        "能说出它与团队现有做法的最大差异和迁移成本。"
      ]
    })
  };
}

/**
 * A deliberately dumb keyword rule, so the triage pipeline can run end to end
 * without a key. Its eval numbers mean nothing about any model — the eval
 * report labels a mock run as such.
 */
function createMockCandidateTriageResponse(
  request: LlmGenerateRequest
): LlmGenerateResponse {
  const prompt = request.userPrompt;
  const isPrerelease = /-(rc|beta|alpha|pre)\d*\b|\brc\d+\b/i.test(prompt);
  const isPromotional = /融资|财报|customer|case study|webinar|峰会|大会/i.test(
    prompt
  );
  const decision = isPrerelease || isPromotional ? "reject" : "review";

  return {
    providerName: "mock",
    modelName: "mock-candidate-triage-v0",
    tokenUsage: {
      promptTokens: Math.ceil(
        (request.systemPrompt.length + prompt.length) / 4
      ),
      completionTokens: 30,
      totalTokens:
        Math.ceil((request.systemPrompt.length + prompt.length) / 4) + 30
    },
    text: JSON.stringify({
      decision,
      confidence: decision === "reject" ? 0.7 : 0.4,
      reason:
        decision === "reject"
          ? "本地 mock 规则：预发布版本或推广类内容。"
          : "本地 mock 规则：没有命中拒绝关键词，交给编辑判断。"
    })
  };
}

/**
 * A fixed-shape draft built from the candidate title and the first ids the
 * catalog lists, so 「AI 起草」 can run end to end without a key. Its prose
 * says nothing about the item.
 */
function createMockCandidateDraftResponse(
  request: LlmGenerateRequest
): LlmGenerateResponse {
  const title = extractPromptValue(request.userPrompt, "标题") || "这条候选";
  const firstIds = (prefix: string, count: number) =>
    [
      ...request.systemPrompt.matchAll(
        new RegExp(`^- (${prefix}[\\w-]+)｜`, "gm")
      )
    ]
      .map((match) => match[1])
      .slice(0, count);
  const [knowledgeId] = firstIds("knowledge-", 1);
  const [skillId] = firstIds("skill-", 1);

  return {
    providerName: "mock",
    modelName: "mock-candidate-draft-v0",
    tokenUsage: {
      promptTokens: Math.ceil(
        (request.systemPrompt.length + request.userPrompt.length) / 4
      ),
      completionTokens: 400,
      totalTokens:
        Math.ceil(
          (request.systemPrompt.length + request.userPrompt.length) / 4
        ) + 400
    },
    text: JSON.stringify({
      title: `${title.slice(0, 40)}（本地 mock 草稿）`,
      summary: `本地 mock 模型根据候选「${title.slice(0, 40)}」写出的占位摘要，只用于在没有密钥时跑通 AI 起草流程，内容不代表原文，发布前必须重写。`,
      content: `## 发生了什么\n\n这是本地 mock 模型生成的占位正文，用来验证 AI 起草的流程。\n\n## 对读者意味着什么\n\n1. 打开原文核对事实。\n2. 重写这段正文。`,
      slug: "mock-candidate-draft",
      type: "tool",
      publisherName: "Mock Publisher",
      publisherType: "open-source-community",
      whyItMatters: "本地 mock 输出，不代表原文。",
      whoShouldCare: ["负责编辑轮的编辑"],
      technicalContext: "本地 mock 输出。",
      impactAreas: ["编辑流程"],
      learningPath: ["阅读原文", "核对数字"],
      followUpQuestions: ["原文的关键数字是什么？"],
      readingDifficulty: "intermediate",
      tags: ["tag-agent-infra", "tag-benchmarks"],
      relatedKnowledge: knowledgeId
        ? [
            {
              id: knowledgeId,
              relationType: "explains",
              note: "mock 附注",
              explanation: "mock 说明"
            }
          ]
        : [],
      relatedSkills: skillId
        ? [
            {
              id: skillId,
              relationType: "supports",
              note: "mock 附注",
              explanation: "mock 说明"
            }
          ]
        : [],
      limitations: ["本地 mock 输出，不代表原文。"]
    })
  };
}

/**
 * A fixed-shape overview built from the first signal titles in the prompt,
 * so 「AI 起草导语」 runs end to end without a key. It says it is a mock, in
 * words the public digest page's internal-copy guard hides.
 */
function createMockOverviewResponse(
  request: LlmGenerateRequest,
  scope: string
): LlmGenerateResponse {
  const titles = [
    ...request.userPrompt.matchAll(/^### \d+\. \[[^\]]+\] (.+)$/gm)
  ]
    .map((match) => match[1].trim())
    .slice(0, 2);
  const named = titles.length
    ? titles.map((title) => `「${title}」`).join("和")
    : "这些信号";

  return {
    providerName: "mock",
    modelName: "mock-overview-v0",
    tokenUsage: {
      promptTokens: Math.ceil(
        (request.systemPrompt.length + request.userPrompt.length) / 4
      ),
      completionTokens: 160,
      totalTokens:
        Math.ceil(
          (request.systemPrompt.length + request.userPrompt.length) / 4
        ) + 160
    },
    text: JSON.stringify({
      editorialSummary: `这是本地 mock 模型为${scope}写的占位导语，只用来在没有密钥时跑通流程，内容不代表信号本身。${named}排在最前面，保存之前请按各条信号的原文重写这一段，写清楚它们之间的联系、关键数字和读者应该先看哪一条。\n\n第二段同样是占位文字：真实模型会在这里交代其余值得跟踪的信号，以及它们与前面几条的关系。`,
      limitations: ["本地 mock 输出，不代表信号内容。"]
    })
  };
}

export function createMockLlmProvider(): LlmProvider {
  return {
    name: "mock",
    modelName: "mock-editorial-enrichment-v0",
    isAvailable() {
      return { available: true };
    },
    async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
      if (process.env.LLM_MOCK_RESPONSE) {
        return {
          text: process.env.LLM_MOCK_RESPONSE,
          providerName: "mock",
          modelName: "mock-editorial-enrichment-v0"
        };
      }

      if (request.userPrompt.startsWith("Purpose: technology_comparison")) {
        return createMockTechnologyComparisonResponse(request);
      }

      if (request.userPrompt.startsWith("Purpose: technology_explanation")) {
        return createMockTechnologyExplanationResponse(request);
      }

      if (request.userPrompt.startsWith("Purpose: technology_learning_path")) {
        return createMockTechnologyLearningPathResponse(request);
      }

      if (request.userPrompt.startsWith("Purpose: candidate_triage")) {
        return createMockCandidateTriageResponse(request);
      }

      if (request.userPrompt.startsWith("Purpose: candidate_draft")) {
        return createMockCandidateDraftResponse(request);
      }

      if (request.userPrompt.startsWith("Purpose: digest_editorial_summary")) {
        return createMockOverviewResponse(request, "这期简报");
      }

      if (request.userPrompt.startsWith("Purpose: weekly_summary")) {
        return createMockOverviewResponse(request, "这一周");
      }

      const title =
        extractPromptValue(request.userPrompt, "Title") ||
        "this technology signal";

      return {
        providerName: "mock",
        modelName: "mock-editorial-enrichment-v0",
        tokenUsage: {
          promptTokens: Math.ceil(request.userPrompt.length / 4),
          completionTokens: 180,
          totalTokens: Math.ceil(request.userPrompt.length / 4) + 180
        },
        text: JSON.stringify({
          whyItMatters: `${title} matters because it may change how teams evaluate, integrate, or govern emerging AI capabilities.`,
          whoShouldCare: [
            "AI engineer",
            "product builder",
            "technical manager"
          ],
          technicalContext:
            "This is a mock LLM-assisted draft generated from the provided title, summary, tags, priority reasons, and related context.",
          impactAreas: [
            "developer tools",
            "agent workflow",
            "enterprise AI adoption"
          ],
          learningPath: [
            "Read the original source to confirm the concrete change.",
            "Review the linked background knowledge before comparing implementation options.",
            "Map the signal to a small evaluation or pilot before broader adoption."
          ],
          relatedKnowledgeExplanations: {},
          relatedSkillExplanations: {},
          followUpQuestions: [
            `What real workflow would ${title} improve first?`,
            "What evidence would justify moving from tracking to piloting?",
            "Which risk or missing capability should be verified before adoption?"
          ],
          readingDifficulty: "intermediate",
          confidence: 0.72,
          limitations: [
            "Generated by the local mock provider; editor review is still required.",
            "The mock provider does not verify facts beyond the supplied draft inputs."
          ]
        })
      };
    }
  };
}
