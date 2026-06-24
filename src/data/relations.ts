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
  }
];
