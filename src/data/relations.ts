import type { LinkRelation } from "@/types/content";

export const linkRelations: LinkRelation[] = [
  {
    id: "rel-mcp-tool-use",
    fromId: "tech-mcp",
    fromType: "technology",
    toId: "knowledge-tool-use",
    toType: "knowledge",
    relationType: "builds-on",
    note: "协议层让工具使用更显式、更可移植。"
  },
  {
    id: "rel-mcp-contracts",
    fromId: "tech-mcp",
    fromType: "technology",
    toId: "knowledge-api-contracts",
    toType: "knowledge",
    relationType: "builds-on",
    note: "稳定的契约能减少脆弱的一次性集成。"
  },
  {
    id: "rel-mcp-integration",
    fromId: "tech-mcp",
    fromType: "technology",
    toId: "skill-tool-integration",
    toType: "skill",
    relationType: "requires",
    note: "团队仍需要规范的工具封装和明确的权责。"
  },
  {
    id: "rel-browser-human",
    fromId: "tech-browser-agents",
    fromType: "technology",
    toId: "knowledge-human-loop",
    toType: "knowledge",
    relationType: "requires",
    note: "浏览器操作足够显眼且有风险，需要人工审查检查点。"
  },
  {
    id: "rel-browser-scope",
    fromId: "tech-browser-agents",
    fromType: "technology",
    toId: "skill-scope-pilots",
    toType: "skill",
    relationType: "supports",
    note: "小范围试点能看清浏览器代理在哪里有用、在哪里脆弱。"
  },
  {
    id: "rel-slm-sizing",
    fromId: "tech-slm-edge",
    fromType: "technology",
    toId: "knowledge-model-sizing",
    toType: "knowledge",
    relationType: "explains",
    note: "端侧模型的价值取决于把约束与能力匹配好。"
  },
  {
    id: "rel-slm-eval",
    fromId: "tech-slm-edge",
    fromType: "technology",
    toId: "skill-model-evaluation",
    toType: "skill",
    relationType: "requires",
    note: "只有在衡量了质量权衡之后，本地部署的选择才有意义。"
  },
  {
    id: "rel-rag-rag-basics",
    fromId: "tech-rag-evals",
    fromType: "technology",
    toId: "knowledge-rag-basics",
    toType: "knowledge",
    relationType: "builds-on",
    note: "只有先理解检索流水线，评测才有意义。"
  },
  {
    id: "rel-rag-eval-loop",
    fromId: "tech-rag-evals",
    fromType: "technology",
    toId: "knowledge-evaluation-loops",
    toType: "knowledge",
    relationType: "explains",
    note: "看板把看不见的质量闭环对团队具象化。"
  },
  {
    id: "rel-rag-tuning",
    fromId: "tech-rag-evals",
    fromType: "technology",
    toId: "skill-retrieval-tuning",
    toType: "skill",
    relationType: "supports",
    note: "好的工具能缩短从一个失败答案到一次检索修复的路径。"
  },
  {
    id: "rel-workbench-design",
    fromId: "tech-agent-workbenches",
    fromType: "technology",
    toId: "skill-agent-design",
    toType: "skill",
    relationType: "supports",
    note: "当底层工作流已经结构化时，工作台最有用。"
  },
  {
    id: "rel-copilot-feedback",
    fromId: "tech-multimodal-copilots",
    fromType: "technology",
    toId: "knowledge-feedback-loops",
    toType: "knowledge",
    relationType: "supports",
    note: "从截图到修改的快速反馈，收紧了团队的学习循环。"
  },
  {
    id: "rel-copilot-communication",
    fromId: "tech-multimodal-copilots",
    fromType: "technology",
    toId: "skill-communication-ai",
    toType: "skill",
    relationType: "supports",
    note: "多模态输入帮助团队用更少的来回把问题讲清楚。"
  },
  {
    id: "rel-kg-graph",
    fromId: "tech-kg-assistants",
    fromType: "technology",
    toId: "knowledge-graph-thinking",
    toType: "knowledge",
    relationType: "builds-on",
    note: "结构化关系是图谱助手的主要优势所在。"
  },
  {
    id: "rel-kg-rag",
    fromId: "tech-kg-assistants",
    fromType: "technology",
    toId: "knowledge-rag-basics",
    toType: "knowledge",
    relationType: "extends",
    note: "图结构可以补充更简单的检索工作流。"
  },
  {
    id: "rel-voice-latency",
    fromId: "tech-voice-runtime",
    fromType: "technology",
    toId: "knowledge-latency-tradeoffs",
    toType: "knowledge",
    relationType: "explains",
    note: "语音系统会以用户可感知的方式暴露延迟问题。"
  },
  {
    id: "rel-voice-communication",
    fromId: "tech-voice-runtime",
    fromType: "technology",
    toId: "skill-communication-ai",
    toType: "skill",
    relationType: "related-to",
    note: "语音产品对清晰度和交互审查提出了更高要求。"
  },
  {
    id: "rel-mcp-browser",
    fromId: "tech-mcp",
    fromType: "technology",
    toId: "tech-browser-agents",
    toType: "technology",
    relationType: "supports",
    note: "浏览器代理常通过 MCP 这类标准接口来请求工具与上下文。"
  },
  {
    id: "rel-mcp-workbench",
    fromId: "tech-mcp",
    fromType: "technology",
    toId: "tech-agent-workbenches",
    toType: "technology",
    relationType: "supports",
    note: "代理工作台通常把 MCP 这类协议接入，作为统一工具层的一部分。"
  },
  {
    id: "rel-mcp-copilot",
    fromId: "tech-mcp",
    fromType: "technology",
    toId: "tech-multimodal-copilots",
    toType: "technology",
    relationType: "related-to",
    note: "多模态编码助手与 MCP 同属让 AI 更顺畅调用工具与上下文的方向。"
  },
  {
    id: "rel-browser-mcp",
    fromId: "tech-browser-agents",
    fromType: "technology",
    toId: "tech-mcp",
    toType: "technology",
    relationType: "builds-on",
    note: "浏览器代理可建立在 MCP 提供的标准工具接口之上，减少一次性适配。"
  },
  {
    id: "rel-browser-workbench",
    fromId: "tech-browser-agents",
    fromType: "technology",
    toId: "tech-agent-workbenches",
    toType: "technology",
    relationType: "related-to",
    note: "浏览器代理常作为代理工作台里需要编排的一类能力。"
  },
  {
    id: "rel-workbench-mcp",
    fromId: "tech-agent-workbenches",
    fromType: "technology",
    toId: "tech-mcp",
    toType: "technology",
    relationType: "uses",
    note: "工作台用 MCP 这类协议统一接入工具，而非各自硬编码。"
  },
  {
    id: "rel-workbench-browser",
    fromId: "tech-agent-workbenches",
    fromType: "technology",
    toId: "tech-browser-agents",
    toType: "technology",
    relationType: "related-to",
    note: "工作台需要编排浏览器代理这类长链路、易出错的能力。"
  },
  {
    id: "rel-copilot-mcp",
    fromId: "tech-multimodal-copilots",
    fromType: "technology",
    toId: "tech-mcp",
    toType: "technology",
    relationType: "related-to",
    note: "多模态助手同样受益于标准化的工具与上下文接入。"
  },
  {
    id: "rel-rag-kg",
    fromId: "tech-rag-evals",
    fromType: "technology",
    toId: "tech-kg-assistants",
    toType: "technology",
    relationType: "related-to",
    note: "知识图谱助手是检索系统的结构化延伸，同样需要评测来验证质量。"
  },
  {
    id: "rel-kg-ragevals",
    fromId: "tech-kg-assistants",
    fromType: "technology",
    toId: "tech-rag-evals",
    toType: "technology",
    relationType: "extends",
    note: "图谱助手在基础检索之上加入显式关系，仍依赖评测看板发现回归。"
  },
  {
    id: "rel-slm-voice",
    fromId: "tech-slm-edge",
    fromType: "technology",
    toId: "tech-voice-runtime",
    toType: "technology",
    relationType: "supports",
    note: "端侧小模型让语音运行层在本地以更低延迟运行成为可能。"
  },
  {
    id: "rel-voice-slm",
    fromId: "tech-voice-runtime",
    fromType: "technology",
    toId: "tech-slm-edge",
    toType: "technology",
    relationType: "uses",
    note: "语音运行层常借助端侧小模型来压低延迟、保护隐私。"
  },
  {
    id: "rel-agent-design-system-design",
    fromId: "skill-agent-design",
    fromType: "skill",
    toId: "knowledge-system-design",
    toType: "knowledge",
    relationType: "builds-on",
    note: "智能体工作流设计建立在延迟、可靠性与可控性这些经典系统权衡之上。"
  },
  {
    id: "rel-agent-design-tool-use",
    fromId: "skill-agent-design",
    fromType: "skill",
    toId: "knowledge-tool-use",
    toType: "knowledge",
    relationType: "requires",
    note: "划清规划与工具调用的边界，需要先理解工具使用这个基础模式。"
  },
  {
    id: "rel-tool-integration-api-contracts",
    fromId: "skill-tool-integration",
    fromType: "skill",
    toId: "knowledge-api-contracts",
    toType: "knowledge",
    relationType: "builds-on",
    note: "可维护的集成依赖清晰的输入输出契约。"
  },
  {
    id: "rel-tool-integration-tool-use",
    fromId: "skill-tool-integration",
    fromType: "skill",
    toId: "knowledge-tool-use",
    toType: "knowledge",
    relationType: "requires",
    note: "接入 API、浏览器和内部工具，需要先分清推理与行动。"
  },
  {
    id: "rel-retrieval-tuning-rag-basics",
    fromId: "skill-retrieval-tuning",
    fromType: "skill",
    toId: "knowledge-rag-basics",
    toType: "knowledge",
    relationType: "builds-on",
    note: "调优检索流水线之前，需要先理解检索增强生成的基础假设。"
  },
  {
    id: "rel-retrieval-tuning-graph-thinking",
    fromId: "skill-retrieval-tuning",
    fromType: "skill",
    toId: "knowledge-graph-thinking",
    toType: "knowledge",
    relationType: "extends",
    note: "当检索需要显式关系而非近似相似度时，这项技能延伸到图思维。"
  },
  {
    id: "rel-model-evaluation-evaluation-loops",
    fromId: "skill-model-evaluation",
    fromType: "skill",
    toId: "knowledge-evaluation-loops",
    toType: "knowledge",
    relationType: "builds-on",
    note: "定义好的输出、衡量失败，正是评估闭环这个经典习惯的具体应用。"
  },
  {
    id: "rel-model-evaluation-feedback-loops",
    fromId: "skill-model-evaluation",
    fromType: "skill",
    toId: "knowledge-feedback-loops",
    toType: "knowledge",
    relationType: "supports",
    note: "小而可复现的评估检查，为团队的反馈闭环提供了具体信号。"
  },
  {
    id: "rel-scope-pilots-feedback-loops",
    fromId: "skill-scope-pilots",
    fromType: "skill",
    toId: "knowledge-feedback-loops",
    toType: "knowledge",
    relationType: "supports",
    note: "聚焦、可快速验证的试点范围，能让团队更快完成一次学习闭环。"
  },
  {
    id: "rel-scope-pilots-human-loop",
    fromId: "skill-scope-pilots",
    fromType: "skill",
    toId: "knowledge-human-loop",
    toType: "knowledge",
    relationType: "requires",
    note: "界定试点范围时，仍需要为影响用户的输出保留人工检查点。"
  },
  {
    id: "rel-communication-ai-feedback-loops",
    fromId: "skill-communication-ai",
    fromType: "skill",
    toId: "knowledge-feedback-loops",
    toType: "knowledge",
    relationType: "supports",
    note: "更清晰的沟通缩短了从草稿到对齐的反馈闭环。"
  },
  {
    id: "rel-communication-ai-human-loop",
    fromId: "skill-communication-ai",
    fromType: "skill",
    toId: "knowledge-human-loop",
    toType: "knowledge",
    relationType: "requires",
    note: "把 AI 输出转化为对外沟通，仍需要人工审阅来把关信任。"
  },
  {
    id: "rel-browser-system-design",
    fromId: "tech-browser-agents",
    fromType: "technology",
    toId: "knowledge-system-design",
    toType: "knowledge",
    relationType: "explains",
    note: "浏览器代理让延迟、可靠性与可控性之间的权衡变得具体可见。"
  },
  {
    id: "rel-slm-latency",
    fromId: "tech-slm-edge",
    fromType: "technology",
    toId: "knowledge-latency-tradeoffs",
    toType: "knowledge",
    relationType: "explains",
    note: "端侧模型的价值直接体现在它如何改变响应延迟的权衡。"
  },
  {
    id: "rel-workbench-system-design",
    fromId: "tech-agent-workbenches",
    fromType: "technology",
    toId: "knowledge-system-design",
    toType: "knowledge",
    relationType: "builds-on",
    note: "工作台的编排选择建立在经典的系统权衡思维之上。"
  },
  {
    id: "rel-workbench-eval-loop",
    fromId: "tech-agent-workbenches",
    fromType: "technology",
    toId: "knowledge-evaluation-loops",
    toType: "knowledge",
    relationType: "requires",
    note: "工作台要持续可靠，仍需要评估闭环来发现回归。"
  },
  {
    id: "rel-copilot-tool-use",
    fromId: "tech-multimodal-copilots",
    fromType: "technology",
    toId: "knowledge-tool-use",
    toType: "knowledge",
    relationType: "builds-on",
    note: "多模态助手调用工具的方式，建立在工具使用这一基础模式之上。"
  },
  {
    id: "rel-voice-human-loop",
    fromId: "tech-voice-runtime",
    fromType: "technology",
    toId: "knowledge-human-loop",
    toType: "knowledge",
    relationType: "requires",
    note: "语音交互影响真实用户体验，仍需要人工审查关键环节。"
  },
  {
    id: "rel-mcp-agent-design",
    fromId: "tech-mcp",
    fromType: "technology",
    toId: "skill-agent-design",
    toType: "skill",
    relationType: "requires",
    note: "设计智能体工作流时，规划与工具调用的边界通常靠 MCP 这类协议来约定。"
  },
  {
    id: "rel-browser-agent-design",
    fromId: "tech-browser-agents",
    fromType: "technology",
    toId: "skill-agent-design",
    toType: "skill",
    relationType: "requires",
    note: "把浏览器操作纳入更长的智能体工作流，需要清晰的步骤划分与回退设计。"
  },
  {
    id: "rel-slm-scope-pilots",
    fromId: "tech-slm-edge",
    fromType: "technology",
    toId: "skill-scope-pilots",
    toType: "skill",
    relationType: "supports",
    note: "边界清晰的试点范围，能更快验证端侧小模型在具体场景下是否够用。"
  },
  {
    id: "rel-rag-model-evaluation",
    fromId: "tech-rag-evals",
    fromType: "technology",
    toId: "skill-model-evaluation",
    toType: "skill",
    relationType: "requires",
    note: "评测看板要发挥作用，仍依赖清晰的模型与输出评估标准。"
  },
  {
    id: "rel-workbench-tool-integration",
    fromId: "tech-agent-workbenches",
    fromType: "technology",
    toId: "skill-tool-integration",
    toType: "skill",
    relationType: "requires",
    note: "工作台要接入多种工具，仍依赖规范的集成模式和错误处理。"
  },
  {
    id: "rel-copilot-tool-integration",
    fromId: "tech-multimodal-copilots",
    fromType: "technology",
    toId: "skill-tool-integration",
    toType: "skill",
    relationType: "uses",
    note: "多模态助手常通过工具集成模式接入代码库、文档和内部系统。"
  },
  {
    id: "rel-kg-retrieval-tuning",
    fromId: "tech-kg-assistants",
    fromType: "technology",
    toId: "skill-retrieval-tuning",
    toType: "skill",
    relationType: "requires",
    note: "图谱助手的检索质量仍取决于底层检索流水线是否调优得当。"
  },
  {
    id: "rel-kg-agent-design",
    fromId: "tech-kg-assistants",
    fromType: "technology",
    toId: "skill-agent-design",
    toType: "skill",
    relationType: "supports",
    note: "结构化的图谱关系能为智能体工作流提供更可靠的规划依据。"
  },
  {
    id: "rel-voice-scope-pilots",
    fromId: "tech-voice-runtime",
    fromType: "technology",
    toId: "skill-scope-pilots",
    toType: "skill",
    relationType: "supports",
    note: "先界定清楚试点范围，能更快看清语音运行层在哪些场景真正好用。"
  }
];
