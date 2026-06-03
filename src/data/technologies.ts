import type { TechnologyItem } from "@/types/content";

export const technologyItems: TechnologyItem[] = [
  {
    id: "tech-mcp",
    title: {
      original: "Model Context Protocol",
      zh: "模型上下文协议"
    },
    slug: "model-context-protocol",
    summary: {
      original:
        "An emerging protocol layer that standardizes how AI tools request context, tools, and capabilities across products.",
      zh: "一种正在形成的协议层，用来标准化 AI 工具在不同产品中请求上下文、工具和能力的方式。"
    },
    content: {
      original:
        "Protocol-based tool access matters because it can reduce fragile one-off integrations. Teams can compare and connect tools through a shared interface instead of rebuilding adapters for every product surface.",
      zh: "基于协议的工具接入方式值得关注，因为它可以减少脆弱的一次性集成。团队可以围绕统一接口比较和接入工具，而不是每次为不同产品界面重新编写适配层。"
    },
    type: "protocol",
    publishDate: "2026-04-10",
    sourceName: "AI Tooling Standards Brief",
    sourceUrl: "https://example.com/technology-signals/model-context-protocol",
    sourceLanguage: "en",
    translationStatus: "done",
    publisherName: "Open Tools Community",
    publisherType: "open-source-community",
    importanceLevel: "critical",
    status: "published",
    tags: ["tag-ai-agents", "tag-workflow"],
    relatedKnowledgeIds: ["knowledge-api-contracts", "knowledge-tool-use"],
    relatedSkillIds: ["skill-tool-integration", "skill-agent-design"],
    whyItMatters:
      "MCP turns context and tool access into a product contract instead of a pile of one-off integrations, which makes agent workflows easier to compare, govern, and reuse.",
    whoShouldCare: [
      "AI engineer",
      "agent developer",
      "product builder",
      "technical manager"
    ],
    technicalContext:
      "It sits in the emerging protocol layer between AI applications, tool providers, data sources, and agent runtimes.",
    impactAreas: ["agent workflow", "developer tools", "enterprise AI adoption"],
    learningPath: [
      "Start with the original protocol announcement and example servers.",
      "Review API contract and tool-use concepts before judging vendor support.",
      "Map one internal workflow where a stable context/tool interface would reduce integration churn."
    ],
    relatedKnowledgeExplanations: {
      "knowledge-api-contracts":
        "MCP is mainly valuable when teams treat tool access as a stable interface contract.",
      "knowledge-tool-use":
        "Tool-use concepts explain how agents request capabilities without hard-coding every workflow."
    },
    relatedSkillExplanations: {
      "skill-tool-integration":
        "Teams need this skill to judge whether protocol support will actually reduce adapter work.",
      "skill-agent-design":
        "Agent design helps decide where context should be requested, scoped, and audited."
    },
    followUpQuestions: [
      "Which internal tools would benefit from a standard context interface first?",
      "How will permissions and traceable access records travel through protocol-based tool calls?",
      "Does protocol support reduce integration cost, or only move complexity elsewhere?"
    ],
    readingDifficulty: "intermediate",
    intelligenceStatus: "reviewed"
  },
  {
    id: "tech-browser-agents",
    title: {
      original: "Browser Automation Agents",
      zh: "浏览器自动化代理"
    },
    slug: "browser-automation-agents",
    summary: {
      original:
        "Browser-driven agents connect planning, web navigation, and real task execution inside products that still depend on websites.",
      zh: "浏览器驱动代理把规划、网页导航和真实任务执行连接起来，适合仍依赖网页流程的产品场景。"
    },
    content: {
      original:
        "Browser agents are useful to study because they expose practical failure modes: brittle selectors, missing state, and poor handoffs between reasoning and execution. They are a visible new capability, but teams should evaluate them through narrow pilots before using them in sensitive workflows."
    },
    type: "workflow",
    publishDate: "2026-04-09",
    sourceName: "Automation Product Brief",
    sourceUrl: "https://example.com/technology-signals/browser-agents",
    sourceLanguage: "en",
    translationStatus: "pending",
    publisherName: "Automation Lab",
    publisherType: "startup",
    importanceLevel: "important",
    status: "published",
    tags: ["tag-ai-agents", "tag-multimodal", "tag-workflow"],
    relatedKnowledgeIds: ["knowledge-human-loop", "knowledge-system-design"],
    relatedSkillIds: ["skill-agent-design", "skill-scope-pilots"]
  },
  {
    id: "tech-slm-edge",
    title: {
      original: "On-device Small Language Models",
      zh: "端侧小语言模型"
    },
    slug: "on-device-small-language-models",
    summary: {
      original:
        "Compact language models are moving some AI workloads from cloud-only deployment into local and edge environments.",
      zh: "小型语言模型正在把一部分 AI 负载从纯云端部署转移到本地和边缘环境。"
    },
    content: {
      original:
        "The value of local models is not only privacy. They also change latency, deployment, and fallback strategy decisions. Teams should understand where small local models outperform large remote ones, and where quality tradeoffs still make remote models necessary.",
      zh: "本地模型的价值不只在隐私。它还会改变延迟、部署方式和回退策略的判断。团队需要理解小型本地模型在哪些场景下比大型远程模型更合适，也要识别哪些场景仍然需要远程大模型的质量能力。"
    },
    type: "model",
    publishDate: "2026-04-07",
    sourceName: "Edge AI Field Notes",
    sourceUrl: "https://example.com/technology-signals/on-device-slm",
    sourceLanguage: "en",
    translationStatus: "done",
    publisherName: "Edge Compute Journal",
    publisherType: "media",
    importanceLevel: "important",
    status: "published",
    tags: ["tag-on-device", "tag-product-strategy"],
    relatedKnowledgeIds: ["knowledge-model-sizing", "knowledge-latency-tradeoffs"],
    relatedSkillIds: ["skill-model-evaluation", "skill-scope-pilots"]
  },
  {
    id: "tech-rag-evals",
    title: {
      original: "RAG Evaluation Dashboards",
      zh: "RAG 评测看板"
    },
    slug: "rag-evaluation-dashboards",
    summary: {
      original:
        "Lightweight dashboards are making retrieval quality, answer faithfulness, and regression checks easier for teams to inspect before launch.",
      zh: "轻量评测看板正在让团队更容易在发布前检查检索质量、答案可信度和回归风险。"
    },
    content: {
      original:
        "Retrieval systems often look fine in early pilots and break once real content, permissions, and edge cases appear. Evaluation dashboards matter because they make quality loops visible to product and engineering teams before launch.",
      zh: "检索系统在早期试点里往往看起来没有问题，但当真实内容、权限边界和边缘情况出现后，很容易暴露缺陷。评测看板的价值在于，它能在正式发布前把质量循环清楚地展示给产品和工程团队。"
    },
    type: "tool",
    publishDate: "2026-04-06",
    sourceName: "Retrieval Quality Digest",
    sourceUrl: "https://example.com/technology-signals/rag-evals",
    sourceLanguage: "en",
    translationStatus: "done",
    publisherName: "Quality Stack",
    publisherType: "startup",
    importanceLevel: "critical",
    status: "published",
    tags: ["tag-retrieval", "tag-observability"],
    relatedKnowledgeIds: ["knowledge-rag-basics", "knowledge-evaluation-loops"],
    relatedSkillIds: ["skill-retrieval-tuning", "skill-model-evaluation"],
    whyItMatters:
      "RAG evaluation dashboards make retrieval failures visible before launch, which helps teams catch regressions that narrow prompt checks miss.",
    whoShouldCare: ["AI engineer", "product builder", "technical manager"],
    technicalContext:
      "This signal belongs to the quality-control layer around retrieval systems and production LLM applications.",
    impactAreas: ["retrieval systems", "evaluation", "enterprise AI adoption"],
    learningPath: [
      "Review basic RAG retrieval flow.",
      "Define the failure cases that matter for your product.",
      "Track answer faithfulness and retrieval quality before broad rollout."
    ],
    relatedKnowledgeExplanations: {
      "knowledge-rag-basics":
        "RAG basics explain what the dashboard is measuring and why retrieval quality changes answer quality.",
      "knowledge-evaluation-loops":
        "Evaluation loops explain how dashboards become an operating practice instead of a one-time test."
    },
    relatedSkillExplanations: {
      "skill-retrieval-tuning":
        "Retrieval tuning is needed to turn dashboard findings into better retrieval behavior.",
      "skill-model-evaluation":
        "Model evaluation helps separate retrieval problems from answer-generation problems."
    },
    followUpQuestions: [
      "Which retrieval failures are most costly for the product?",
      "Can the dashboard catch permission and freshness errors?",
      "Who owns regression review before launch?"
    ],
    readingDifficulty: "intermediate",
    intelligenceStatus: "reviewed"
  },
  {
    id: "tech-agent-workbenches",
    title: {
      original: "Agent Workbench Platforms",
      zh: "代理工作台平台"
    },
    slug: "agent-workbench-platforms",
    summary: {
      original:
        "Agent workbenches bundle prompts, tools, logs, and experiments into one operator view for teams building repeatable AI workflows.",
      zh: "代理工作台把提示词、工具、日志和实验整合到统一操作视图中，帮助团队构建可重复的 AI 工作流。"
    },
    content: {
      original:
        "Workbenches matter because teams rarely fail from model quality alone. They often fail from coordination overhead, missing observability, and unclear ownership. Platform-style workbenches package many smaller practices into one operational surface."
    },
    type: "platform",
    publishDate: "2026-04-05",
    sourceName: "Agent Platform Review",
    sourceUrl: "https://example.com/technology-signals/agent-workbenches",
    sourceLanguage: "en",
    translationStatus: "pending",
    publisherName: "TeamOps Cloud",
    publisherType: "big-tech",
    importanceLevel: "important",
    status: "published",
    tags: ["tag-ai-agents", "tag-observability", "tag-workflow"],
    relatedKnowledgeIds: ["knowledge-system-design", "knowledge-evaluation-loops"],
    relatedSkillIds: ["skill-agent-design", "skill-tool-integration"]
  },
  {
    id: "tech-multimodal-copilots",
    title: {
      original: "Multimodal Coding Copilots",
      zh: "多模态编码助手"
    },
    slug: "multimodal-coding-copilots",
    summary: {
      original:
        "Coding assistants that combine text, screenshots, and repository context are shortening the path from issue report to actionable change.",
      zh: "结合文本、截图和仓库上下文的编码助手，正在缩短从问题描述到可执行修改之间的距离。"
    },
    content: {
      original:
        "These tools are noteworthy because they reduce the gap between a bug report and an actionable change. Product and engineering teams should watch them as a signal of how AI changes development workflows, review loops, and communication quality."
    },
    type: "tool",
    publishDate: "2026-04-04",
    sourceName: "Developer Workflow Notes",
    sourceUrl: "https://example.com/technology-signals/multimodal-copilots",
    sourceLanguage: "en",
    translationStatus: "pending",
    publisherName: "Dev Productivity Review",
    publisherType: "media",
    importanceLevel: "important",
    status: "published",
    tags: ["tag-multimodal", "tag-workflow"],
    relatedKnowledgeIds: ["knowledge-feedback-loops", "knowledge-tool-use"],
    relatedSkillIds: ["skill-tool-integration", "skill-communication-ai"]
  },
  {
    id: "tech-kg-assistants",
    title: {
      original: "Knowledge-Graph Assistants"
    },
    slug: "knowledge-graph-assistants",
    summary: {
      original:
        "Assistants that combine LLM reasoning with explicit graph relationships are becoming relevant where loose semantic similarity is not enough."
    },
    content: {
      original:
        "Graph-backed assistants are interesting when loose semantic similarity is not enough. They show how newer conversational interfaces can still depend on older information architecture ideas such as entity modeling, relationship design, and provenance."
    },
    type: "platform",
    publishDate: "2026-04-02",
    sourceName: "Information Architecture Memo",
    sourceUrl: "https://example.com/technology-signals/kg-assistants",
    sourceLanguage: "en",
    translationStatus: "pending",
    publisherName: "Structured Data Lab",
    publisherType: "research-lab",
    importanceLevel: "signal",
    status: "published",
    tags: ["tag-knowledge-graph", "tag-ai-agents", "tag-retrieval"],
    relatedKnowledgeIds: ["knowledge-graph-thinking", "knowledge-rag-basics"],
    relatedSkillIds: ["skill-retrieval-tuning", "skill-agent-design"]
  },
  {
    id: "tech-voice-runtime",
    title: {
      original: "Voice Agent Runtime",
      zh: "语音代理运行层"
    },
    slug: "voice-agent-runtime",
    summary: {
      original:
        "Voice agent runtimes combine speech, intent handling, and tool calls into orchestration layers for real-time interaction.",
      zh: "语音代理运行层把语音、意图处理和工具调用组合成面向实时交互的编排层。"
    },
    content: {
      original:
        "Voice runtimes show that teams should track interaction shifts, not only model releases. They surface operational concerns such as latency, interruption handling, and handoff quality in a way users can immediately feel.",
      zh: "语音运行层说明，团队不应只追踪模型发布，还要关注交互方式的变化。它会把延迟、中断处理和交接质量这类运营问题直接暴露在用户体验中。"
    },
    type: "platform",
    publishDate: "2026-04-01",
    sourceName: "Conversational Interface Report",
    sourceUrl: "https://example.com/technology-signals/voice-runtime",
    sourceLanguage: "en",
    translationStatus: "done",
    publisherName: "Conversational Systems Group",
    publisherType: "startup",
    importanceLevel: "signal",
    status: "published",
    tags: ["tag-multimodal", "tag-workflow", "tag-on-device"],
    relatedKnowledgeIds: ["knowledge-latency-tradeoffs", "knowledge-human-loop"],
    relatedSkillIds: ["skill-communication-ai", "skill-scope-pilots"]
  }
];

export const homeFeaturedTechnologyIds = [
  "tech-mcp",
  "tech-rag-evals",
  "tech-slm-edge"
];
