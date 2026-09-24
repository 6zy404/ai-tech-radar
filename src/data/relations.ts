import type { LinkRelation } from "@/types/content";

export const linkRelations: LinkRelation[] = [
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
  }
];
