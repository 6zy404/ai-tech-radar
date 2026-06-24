import type { KnowledgeItem } from "@/types/content";

export const knowledgeItems: KnowledgeItem[] = [
  {
    id: "knowledge-api-contracts",
    title: "API 契约与接口边界",
    slug: "api-contracts-and-interface-boundaries",
    summary:
      "当 AI 系统调用工具、串联服务或交换结构化上下文时，稳定的契约至关重要。",
    content:
      "这个经典概念解释了为什么明确的输入和输出能提升可靠性。即便接口被包裹在智能体框架里，它依然适用。",
    category: "software-architecture",
    difficulty: "foundation",
    tags: ["tag-workflow"],
    relatedTechnologyIds: ["tech-mcp"],
    relatedSkillIds: ["skill-tool-integration"]
  },
  {
    id: "knowledge-tool-use",
    title: "工具使用与函数调用",
    slug: "tool-use-and-function-calling",
    summary:
      "许多新智能体系统背后的老思想：把推理与行动分离，并对两者分别验证。",
    content:
      "理解工具使用，能让你在比较协议、SDK 和智能体产品时不被品牌包装干扰。它是连接新工具与持久模式的关键桥梁。",
    category: "software-architecture",
    difficulty: "intermediate",
    tags: ["tag-ai-agents", "tag-workflow"],
    relatedTechnologyIds: ["tech-mcp", "tech-multimodal-copilots"],
    relatedSkillIds: ["skill-agent-design", "skill-tool-integration"]
  },
  {
    id: "knowledge-rag-basics",
    title: "检索增强生成基础",
    slug: "retrieval-augmented-generation-basics",
    summary:
      "为什么外部知识检索会改变答案的质量、时效性和信任边界。",
    content:
      "RAG 仍是基础概念，因为它澄清了模型自身记忆何时不够用。团队可以借它来判断新的检索产品为何重要、又为何会失败。",
    category: "data",
    difficulty: "foundation",
    tags: ["tag-retrieval"],
    relatedTechnologyIds: ["tech-rag-evals", "tech-kg-assistants"],
    relatedSkillIds: ["skill-retrieval-tuning"]
  },
  {
    id: "knowledge-evaluation-loops",
    title: "评估闭环",
    slug: "evaluation-loops",
    summary:
      "一种经典的运营习惯：定义预期结果、观察失败、不断收紧闭环。",
    content:
      "评估闭环并非 AI 独有，而这恰恰是它重要的原因。这个概念帮助团队避免把新模型的行为当成无法理解的魔法。",
    category: "operations",
    difficulty: "intermediate",
    tags: ["tag-observability"],
    relatedTechnologyIds: ["tech-rag-evals", "tech-agent-workbenches"],
    relatedSkillIds: ["skill-model-evaluation"]
  },
  {
    id: "knowledge-system-design",
    title: "系统设计的权衡",
    slug: "system-design-tradeoffs",
    summary:
      "当产品由 AI 驱动时，延迟、可靠性、成本和可控性这些权衡依然适用。",
    content:
      "这个概念把经典架构思维与新的智能体平台连接起来，帮助读者思考：哪些应由工作流自己掌控，哪些应交给平台去抽象。",
    category: "software-architecture",
    difficulty: "intermediate",
    tags: ["tag-workflow", "tag-product-strategy"],
    relatedTechnologyIds: ["tech-browser-agents", "tech-agent-workbenches"],
    relatedSkillIds: ["skill-agent-design"]
  },
  {
    id: "knowledge-human-loop",
    title: "人在回路的审查",
    slug: "human-in-the-loop-review",
    summary:
      "当输出会影响客户、运营或对外沟通时，人工检查点仍然不可或缺。",
    content:
      "新工具可能自动化更多步骤，但审查设计仍决定信任。这个概念解释了如何把人的决策放在最能创造价值的位置。",
    category: "operations",
    difficulty: "foundation",
    tags: ["tag-product-strategy", "tag-workflow"],
    relatedTechnologyIds: ["tech-browser-agents", "tech-voice-runtime"],
    relatedSkillIds: ["skill-scope-pilots", "skill-communication-ai"]
  },
  {
    id: "knowledge-graph-thinking",
    title: "面向知识系统的图思维",
    slug: "graph-thinking-for-knowledge-systems",
    summary:
      "把概念和关联显式建模，能让某些推理更易于检查和维护。",
    content:
      "这个经典的知识组织概念之所以再次有用，是因为 AI 产品越来越需要可解释的关系，而不只是最近邻相似度。",
    category: "data",
    difficulty: "advanced",
    tags: ["tag-knowledge-graph", "tag-retrieval"],
    relatedTechnologyIds: ["tech-kg-assistants"],
    relatedSkillIds: ["skill-retrieval-tuning"]
  },
  {
    id: "knowledge-model-sizing",
    title: "模型选型与约束匹配",
    slug: "model-sizing-and-constraint-matching",
    summary:
      "根据延迟、隐私、成本和任务复杂度来选择模型规模，而不是只看名气。",
    content:
      "这个概念帮助团队理解：在边缘或高并发场景下，较小的模型为何可能在策略上更优。它是做本地模型决策的有用视角。",
    category: "machine-learning",
    difficulty: "intermediate",
    tags: ["tag-on-device", "tag-product-strategy"],
    relatedTechnologyIds: ["tech-slm-edge"],
    relatedSkillIds: ["skill-model-evaluation"]
  },
  {
    id: "knowledge-latency-tradeoffs",
    title: "交互系统中的延迟权衡",
    slug: "latency-tradeoffs-in-interactive-systems",
    summary:
      "当用户必须等待语音、检索或漫长的多步操作时，交互设计也随之改变。",
    content:
      "这个经典的系统经验在语音和端侧 AI 产品中再次显现。团队需要它来权衡响应速度、批处理和回退行为。",
    category: "software-architecture",
    difficulty: "intermediate",
    tags: ["tag-on-device", "tag-multimodal"],
    relatedTechnologyIds: ["tech-slm-edge", "tech-voice-runtime"],
    relatedSkillIds: ["skill-scope-pilots"]
  },
  {
    id: "knowledge-feedback-loops",
    title: "反馈闭环与团队学习",
    slug: "feedback-loops-and-team-learning",
    summary:
      "小而可见的闭环，比目标模糊的大版本发布更能让团队快速学习。",
    content:
      "这个概念重要，是因为许多 AI 项目失败于学习节奏太慢，而非模型不行。它同时支撑沟通实践和试点范围界定。",
    category: "product-thinking",
    difficulty: "foundation",
    tags: ["tag-product-strategy", "tag-observability"],
    relatedTechnologyIds: ["tech-multimodal-copilots"],
    relatedSkillIds: [
      "skill-model-evaluation",
      "skill-communication-ai",
      "skill-scope-pilots"
    ]
  }
];
