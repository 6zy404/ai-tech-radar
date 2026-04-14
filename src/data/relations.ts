import type { LinkRelation } from "@/types/content";

export const linkRelations: LinkRelation[] = [
  {
    id: "rel-mcp-tool-use",
    fromId: "tech-mcp",
    fromType: "technology",
    toId: "knowledge-tool-use",
    toType: "knowledge",
    relationType: "builds-on",
    note: "Protocol layers make tool use more explicit and portable."
  },
  {
    id: "rel-mcp-contracts",
    fromId: "tech-mcp",
    fromType: "technology",
    toId: "knowledge-api-contracts",
    toType: "knowledge",
    relationType: "builds-on",
    note: "Stable contracts reduce fragile one-off integrations."
  },
  {
    id: "rel-mcp-integration",
    fromId: "tech-mcp",
    fromType: "technology",
    toId: "skill-tool-integration",
    toType: "skill",
    relationType: "requires",
    note: "Teams still need disciplined tool wrappers and ownership."
  },
  {
    id: "rel-browser-human",
    fromId: "tech-browser-agents",
    fromType: "technology",
    toId: "knowledge-human-loop",
    toType: "knowledge",
    relationType: "requires",
    note: "Browser actions are visible and risky enough to need review checkpoints."
  },
  {
    id: "rel-browser-scope",
    fromId: "tech-browser-agents",
    fromType: "technology",
    toId: "skill-scope-pilots",
    toType: "skill",
    relationType: "supports",
    note: "Narrow pilots reveal where browser agents help versus where they are brittle."
  },
  {
    id: "rel-slm-sizing",
    fromId: "tech-slm-edge",
    fromType: "technology",
    toId: "knowledge-model-sizing",
    toType: "knowledge",
    relationType: "explains",
    note: "The value of edge models depends on matching constraints to capability."
  },
  {
    id: "rel-slm-eval",
    fromId: "tech-slm-edge",
    fromType: "technology",
    toId: "skill-model-evaluation",
    toType: "skill",
    relationType: "requires",
    note: "Local deployment choices are only useful when quality tradeoffs are measured."
  },
  {
    id: "rel-rag-rag-basics",
    fromId: "tech-rag-evals",
    fromType: "technology",
    toId: "knowledge-rag-basics",
    toType: "knowledge",
    relationType: "builds-on",
    note: "Evaluation only makes sense when the retrieval pipeline is understood first."
  },
  {
    id: "rel-rag-eval-loop",
    fromId: "tech-rag-evals",
    fromType: "technology",
    toId: "knowledge-evaluation-loops",
    toType: "knowledge",
    relationType: "explains",
    note: "Dashboards make invisible quality loops concrete for teams."
  },
  {
    id: "rel-rag-tuning",
    fromId: "tech-rag-evals",
    fromType: "technology",
    toId: "skill-retrieval-tuning",
    toType: "skill",
    relationType: "supports",
    note: "Good tooling shortens the path from a failed answer to a retrieval fix."
  },
  {
    id: "rel-workbench-design",
    fromId: "tech-agent-workbenches",
    fromType: "technology",
    toId: "skill-agent-design",
    toType: "skill",
    relationType: "supports",
    note: "Workbenches are most useful when the underlying workflow is already structured."
  },
  {
    id: "rel-copilot-feedback",
    fromId: "tech-multimodal-copilots",
    fromType: "technology",
    toId: "knowledge-feedback-loops",
    toType: "knowledge",
    relationType: "supports",
    note: "Fast screenshot-to-change feedback tightens team learning cycles."
  },
  {
    id: "rel-copilot-communication",
    fromId: "tech-multimodal-copilots",
    fromType: "technology",
    toId: "skill-communication-ai",
    toType: "skill",
    relationType: "supports",
    note: "Multimodal inputs help teams explain issues with less back-and-forth."
  },
  {
    id: "rel-kg-graph",
    fromId: "tech-kg-assistants",
    fromType: "technology",
    toId: "knowledge-graph-thinking",
    toType: "knowledge",
    relationType: "builds-on",
    note: "Structured relationships give graph-backed assistants their main advantage."
  },
  {
    id: "rel-kg-rag",
    fromId: "tech-kg-assistants",
    fromType: "technology",
    toId: "knowledge-rag-basics",
    toType: "knowledge",
    relationType: "extends",
    note: "Graph structure can complement simpler retrieval workflows."
  },
  {
    id: "rel-voice-latency",
    fromId: "tech-voice-runtime",
    fromType: "technology",
    toId: "knowledge-latency-tradeoffs",
    toType: "knowledge",
    relationType: "explains",
    note: "Voice systems surface latency problems in a user-visible way."
  },
  {
    id: "rel-voice-communication",
    fromId: "tech-voice-runtime",
    fromType: "technology",
    toId: "skill-communication-ai",
    toType: "skill",
    relationType: "related-to",
    note: "Voice products raise the bar for clarity and interaction review."
  }
];
