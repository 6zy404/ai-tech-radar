import type { SkillItem } from "@/types/content";

export const skillItems: SkillItem[] = [
  {
    id: "skill-agent-design",
    title: "智能体工作流设计",
    slug: "agent-workflow-design",
    summary: "设计多步骤 AI 流程，在规划、工具调用与审查之间划清边界。",
    content:
      "这项技能强调任务拆解、护栏设计和回退方案。当团队从单条提示词转向更长链路的任务流程时，它就变得重要。",
    skillType: "engineering",
    heatLevel: "hot",
    learningCost: "high",
    tags: ["tag-ai-agents", "tag-workflow"],
    relatedTechnologyIds: [
      "tech-mcp",
      "tech-browser-agents",
      "tech-agent-workbenches"
    ],
    relatedKnowledgeIds: ["knowledge-system-design", "knowledge-tool-use"]
  },
  {
    id: "skill-tool-integration",
    title: "工具集成模式",
    slug: "tool-integration-patterns",
    summary: "以可维护的方式，把 AI 系统接入 API、浏览器、文档和内部工具。",
    content:
      "这项技能涵盖接口契约、错误处理和可审计性，处在产品想法与可上线落地之间。",
    skillType: "engineering",
    heatLevel: "active",
    learningCost: "medium",
    tags: ["tag-ai-agents", "tag-workflow"],
    relatedTechnologyIds: [
      "tech-mcp",
      "tech-multimodal-copilots",
      "tech-agent-workbenches"
    ],
    relatedKnowledgeIds: ["knowledge-api-contracts", "knowledge-tool-use"]
  },
  {
    id: "skill-retrieval-tuning",
    title: "检索流水线调优",
    slug: "retrieval-pipeline-tuning",
    summary: "优化分块、索引、重排选择和结果格式，让回答更有依据。",
    content:
      "这项技能之所以重要，是因为检索质量常常是 AI 输出不佳背后隐藏的瓶颈。它把新工具与经典的信息检索概念连接起来。",
    skillType: "analysis",
    heatLevel: "hot",
    learningCost: "high",
    tags: ["tag-retrieval", "tag-observability"],
    relatedTechnologyIds: ["tech-rag-evals", "tech-kg-assistants"],
    relatedKnowledgeIds: ["knowledge-rag-basics", "knowledge-graph-thinking"]
  },
  {
    id: "skill-model-evaluation",
    title: "模型与输出评估",
    slug: "model-and-output-evaluation",
    summary: "在上线前定义什么是好的输出，并用小而可复现的检查来衡量它。",
    content:
      "这项技能关注测试设计，而非追逐榜单。它能帮助团队判断哪些新的 AI 能力值得深入投入。",
    skillType: "analysis",
    heatLevel: "active",
    learningCost: "medium",
    tags: ["tag-observability", "tag-product-strategy"],
    relatedTechnologyIds: ["tech-rag-evals", "tech-slm-edge"],
    relatedKnowledgeIds: [
      "knowledge-evaluation-loops",
      "knowledge-feedback-loops"
    ]
  },
  {
    id: "skill-scope-pilots",
    title: "AI 试点范围界定",
    slug: "ai-pilot-scoping",
    summary: "选择既有足够价值、又足够聚焦、能快速学到东西的用例。",
    content:
      "这项技能刻意偏向产品视角，帮助团队避免把表面的新鲜感误当成值得投入的价值。",
    skillType: "product",
    heatLevel: "active",
    learningCost: "low",
    tags: ["tag-product-strategy", "tag-workflow"],
    relatedTechnologyIds: [
      "tech-browser-agents",
      "tech-slm-edge",
      "tech-voice-runtime"
    ],
    relatedKnowledgeIds: ["knowledge-feedback-loops", "knowledge-human-loop"]
  },
  {
    id: "skill-communication-ai",
    title: "AI 辅助沟通审阅",
    slug: "ai-assisted-communication-review",
    summary: "借助 AI 工具，把截图、日志和草稿文本转化为更清晰的工程沟通。",
    content:
      "这项技能重要，是因为许多看得见的 AI 收益来自更快的对齐，而非完全自动化。它与多模态工具尤其契合。",
    skillType: "communication",
    heatLevel: "emerging",
    learningCost: "low",
    tags: ["tag-multimodal", "tag-workflow"],
    relatedTechnologyIds: ["tech-multimodal-copilots", "tech-voice-runtime"],
    relatedKnowledgeIds: ["knowledge-feedback-loops", "knowledge-human-loop"]
  }
];
