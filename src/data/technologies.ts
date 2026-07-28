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
    sourceName: "AI 工具标准简报",
    sourceUrl: "https://example.com/technology-signals/model-context-protocol",
    sourceLanguage: "en",
    translationStatus: "done",
    publisherName: "开放工具社区",
    publisherType: "open-source-community",
    importanceLevel: "critical",
    status: "published",
    tags: ["tag-ai-agents", "tag-workflow"],
    relatedKnowledgeIds: ["knowledge-api-contracts", "knowledge-tool-use"],
    relatedSkillIds: ["skill-tool-integration", "skill-agent-design"],
    relatedTechnologyIds: [
      "tech-browser-agents",
      "tech-agent-workbenches",
      "tech-multimodal-copilots"
    ],
    whyItMatters:
      "MCP 把上下文和工具接入变成一份产品契约，而不是一堆一次性集成，让智能体工作流更易于比较、治理和复用。",
    whoShouldCare: ["AI 工程师", "智能体开发者", "产品构建者", "技术管理者"],
    technicalContext:
      "它处于正在形成的协议层，连接 AI 应用、工具提供方、数据源和智能体运行时。",
    impactAreas: ["智能体工作流", "开发者工具", "企业 AI 落地"],
    learningPath: [
      "先从原始协议公告和示例服务端开始。",
      "在评判厂商支持之前，先复习 API 契约和工具使用的概念。",
      "找出一条内部工作流，看看稳定的上下文/工具接口能在哪里减少集成反复。"
    ],
    relatedKnowledgeExplanations: {
      "knowledge-api-contracts":
        "只有当团队把工具接入当作稳定的接口契约时，MCP 才最有价值。",
      "knowledge-tool-use":
        "工具使用的概念解释了智能体如何在不硬编码每条工作流的情况下请求能力。"
    },
    relatedSkillExplanations: {
      "skill-tool-integration":
        "团队需要这项技能来判断协议支持是否真能减少适配层的工作量。",
      "skill-agent-design":
        "智能体设计帮助决定上下文应在何处被请求、限定范围和审计。"
    },
    followUpQuestions: [
      "哪些内部工具会最先从标准上下文接口中获益？",
      "权限和可追溯的访问记录如何在基于协议的工具调用中传递？",
      "协议支持是真的降低了集成成本，还是只是把复杂度转移到了别处？"
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
        "Browser agents are useful to study because they expose practical failure modes: brittle selectors, missing state, and poor handoffs between reasoning and execution. They are a visible new capability, but teams should evaluate them through narrow pilots before using them in sensitive workflows.",
      zh: "浏览器代理值得研究，因为它们暴露了实际的失败模式：脆弱的选择器、缺失的状态，以及推理与执行之间糟糕的交接。它们是看得见的新能力，但团队应先通过小范围试点评估，再用于敏感工作流。"
    },
    type: "workflow",
    publishDate: "2026-04-09",
    sourceName: "自动化产品简报",
    sourceUrl: "https://example.com/technology-signals/browser-agents",
    sourceLanguage: "en",
    translationStatus: "done",
    publisherName: "自动化实验室",
    publisherType: "startup",
    importanceLevel: "important",
    status: "published",
    tags: ["tag-ai-agents", "tag-multimodal", "tag-workflow"],
    relatedKnowledgeIds: ["knowledge-human-loop", "knowledge-system-design"],
    relatedSkillIds: ["skill-agent-design", "skill-scope-pilots"],
    relatedTechnologyIds: ["tech-mcp", "tech-agent-workbenches"]
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
    sourceName: "边缘 AI 实地笔记",
    sourceUrl: "https://example.com/technology-signals/on-device-slm",
    sourceLanguage: "en",
    translationStatus: "done",
    publisherName: "边缘计算期刊",
    publisherType: "media",
    importanceLevel: "important",
    status: "published",
    tags: ["tag-on-device", "tag-product-strategy"],
    relatedKnowledgeIds: [
      "knowledge-model-sizing",
      "knowledge-latency-tradeoffs"
    ],
    relatedSkillIds: ["skill-model-evaluation", "skill-scope-pilots"],
    relatedTechnologyIds: ["tech-voice-runtime"]
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
    sourceName: "检索质量摘要",
    sourceUrl: "https://example.com/technology-signals/rag-evals",
    sourceLanguage: "en",
    translationStatus: "done",
    publisherName: "质量栈",
    publisherType: "startup",
    importanceLevel: "critical",
    status: "published",
    tags: ["tag-retrieval", "tag-observability"],
    relatedKnowledgeIds: ["knowledge-rag-basics", "knowledge-evaluation-loops"],
    relatedSkillIds: ["skill-retrieval-tuning", "skill-model-evaluation"],
    relatedTechnologyIds: ["tech-kg-assistants"],
    whyItMatters:
      "RAG 评测看板让检索失败在上线前就暴露出来，帮助团队发现那些狭窄的提示词检查会漏掉的回归。",
    whoShouldCare: ["AI 工程师", "产品构建者", "技术管理者"],
    technicalContext: "这个信号属于围绕检索系统和生产级 LLM 应用的质量控制层。",
    impactAreas: ["检索系统", "评估", "企业 AI 落地"],
    learningPath: [
      "先复习基本的 RAG 检索流程。",
      "定义对你的产品而言重要的失败场景。",
      "在大规模铺开前，跟踪答案可信度和检索质量。"
    ],
    relatedKnowledgeExplanations: {
      "knowledge-rag-basics":
        "RAG 基础解释了看板在衡量什么，以及检索质量为何会改变答案质量。",
      "knowledge-evaluation-loops":
        "评估闭环解释了看板如何从一次性测试变成持续的运营实践。"
    },
    relatedSkillExplanations: {
      "skill-retrieval-tuning":
        "需要检索调优，才能把看板发现转化为更好的检索行为。",
      "skill-model-evaluation": "模型评估有助于把检索问题与答案生成问题区分开。"
    },
    followUpQuestions: [
      "哪些检索失败对产品代价最高？",
      "看板能否捕捉权限和时效性方面的错误？",
      "上线前的回归审查由谁负责？"
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
        "Workbenches matter because teams rarely fail from model quality alone. They often fail from coordination overhead, missing observability, and unclear ownership. Platform-style workbenches package many smaller practices into one operational surface.",
      zh: "工作台之所以重要，是因为团队很少只因模型质量而失败，更多是败于协调成本、可观测性缺失和权责不清。平台式工作台把许多零散的实践打包进一个统一的操作界面。"
    },
    type: "platform",
    publishDate: "2026-04-05",
    sourceName: "智能体平台评测",
    sourceUrl: "https://example.com/technology-signals/agent-workbenches",
    sourceLanguage: "en",
    translationStatus: "done",
    publisherName: "TeamOps 云",
    publisherType: "big-tech",
    importanceLevel: "important",
    status: "published",
    tags: ["tag-ai-agents", "tag-observability", "tag-workflow"],
    relatedKnowledgeIds: [
      "knowledge-system-design",
      "knowledge-evaluation-loops"
    ],
    relatedSkillIds: ["skill-agent-design", "skill-tool-integration"],
    relatedTechnologyIds: ["tech-mcp", "tech-browser-agents"]
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
        "These tools are noteworthy because they reduce the gap between a bug report and an actionable change. Product and engineering teams should watch them as a signal of how AI changes development workflows, review loops, and communication quality.",
      zh: "这些工具值得关注，因为它们缩短了从问题报告到可执行修改之间的距离。产品和工程团队应把它们视作 AI 如何改变开发流程、评审闭环和沟通质量的信号。"
    },
    type: "tool",
    publishDate: "2026-04-04",
    sourceName: "开发者工作流笔记",
    sourceUrl: "https://example.com/technology-signals/multimodal-copilots",
    sourceLanguage: "en",
    translationStatus: "done",
    publisherName: "开发效率评测",
    publisherType: "media",
    importanceLevel: "important",
    status: "published",
    tags: ["tag-multimodal", "tag-workflow"],
    relatedKnowledgeIds: ["knowledge-feedback-loops", "knowledge-tool-use"],
    relatedSkillIds: ["skill-tool-integration", "skill-communication-ai"],
    relatedTechnologyIds: ["tech-mcp"]
  },
  {
    id: "tech-kg-assistants",
    title: {
      original: "Knowledge-Graph Assistants",
      zh: "知识图谱助手"
    },
    slug: "knowledge-graph-assistants",
    summary: {
      original:
        "Assistants that combine LLM reasoning with explicit graph relationships are becoming relevant where loose semantic similarity is not enough.",
      zh: "把 LLM 推理与显式图关系结合的助手，在松散的语义相似度不够用的场景里变得越来越重要。"
    },
    content: {
      original:
        "Graph-backed assistants are interesting when loose semantic similarity is not enough. They show how newer conversational interfaces can still depend on older information architecture ideas such as entity modeling, relationship design, and provenance.",
      zh: "当松散的语义相似度不够用时，基于图的助手就很有意思。它们展示了较新的对话式界面如何仍然依赖较旧的信息架构思想，例如实体建模、关系设计和来源溯源。"
    },
    type: "platform",
    publishDate: "2026-04-02",
    sourceName: "信息架构备忘",
    sourceUrl: "https://example.com/technology-signals/kg-assistants",
    sourceLanguage: "en",
    translationStatus: "done",
    publisherName: "结构化数据实验室",
    publisherType: "research-lab",
    importanceLevel: "signal",
    status: "published",
    tags: ["tag-knowledge-graph", "tag-ai-agents", "tag-retrieval"],
    relatedKnowledgeIds: ["knowledge-graph-thinking", "knowledge-rag-basics"],
    relatedSkillIds: ["skill-retrieval-tuning", "skill-agent-design"],
    relatedTechnologyIds: ["tech-rag-evals"]
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
    sourceName: "对话式界面报告",
    sourceUrl: "https://example.com/technology-signals/voice-runtime",
    sourceLanguage: "en",
    translationStatus: "done",
    publisherName: "对话式系统团队",
    publisherType: "startup",
    importanceLevel: "signal",
    status: "published",
    tags: ["tag-multimodal", "tag-workflow", "tag-on-device"],
    relatedKnowledgeIds: [
      "knowledge-latency-tradeoffs",
      "knowledge-human-loop"
    ],
    relatedSkillIds: ["skill-communication-ai", "skill-scope-pilots"],
    relatedTechnologyIds: ["tech-slm-edge"]
  }
];

export const homeFeaturedTechnologyIds = [
  "tech-mcp",
  "tech-rag-evals",
  "tech-slm-edge"
];
