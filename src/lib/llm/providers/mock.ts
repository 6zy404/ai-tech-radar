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
