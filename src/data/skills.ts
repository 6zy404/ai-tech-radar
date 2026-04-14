import type { SkillItem } from "@/types/content";

export const skillItems: SkillItem[] = [
  {
    id: "skill-agent-design",
    title: "Agent Workflow Design",
    slug: "agent-workflow-design",
    summary:
      "Designing multi-step AI flows with clear boundaries between planning, tool use, and review.",
    content:
      "This mock skill emphasizes decomposition, guardrails, and fallback design. It is relevant whenever teams move from single prompts to longer-running task flows.",
    skillType: "engineering",
    heatLevel: "hot",
    learningCost: "high",
    tags: ["tag-ai-agents", "tag-workflow"],
    relatedTechnologyIds: ["tech-mcp", "tech-browser-agents", "tech-agent-workbenches"],
    relatedKnowledgeIds: ["knowledge-system-design", "knowledge-tool-use"]
  },
  {
    id: "skill-tool-integration",
    title: "Tool Integration Patterns",
    slug: "tool-integration-patterns",
    summary:
      "Connecting AI systems to APIs, browsers, documents, and internal tooling in a maintainable way.",
    content:
      "This demo skill covers interface contracts, error handling, and auditability. It sits between product ideas and production-ready execution.",
    skillType: "engineering",
    heatLevel: "active",
    learningCost: "medium",
    tags: ["tag-ai-agents", "tag-workflow"],
    relatedTechnologyIds: ["tech-mcp", "tech-multimodal-copilots", "tech-agent-workbenches"],
    relatedKnowledgeIds: ["knowledge-api-contracts", "knowledge-tool-use"]
  },
  {
    id: "skill-retrieval-tuning",
    title: "Retrieval Pipeline Tuning",
    slug: "retrieval-pipeline-tuning",
    summary:
      "Improving chunking, indexing, reranking choices, and result formatting for grounded answers.",
    content:
      "This mock skill exists because retrieval quality is often the hidden bottleneck behind weak AI outputs. It links new tooling with older information retrieval concepts.",
    skillType: "analysis",
    heatLevel: "hot",
    learningCost: "high",
    tags: ["tag-retrieval", "tag-observability"],
    relatedTechnologyIds: ["tech-rag-evals", "tech-kg-assistants"],
    relatedKnowledgeIds: ["knowledge-rag-basics", "knowledge-graph-thinking"]
  },
  {
    id: "skill-model-evaluation",
    title: "Model and Output Evaluation",
    slug: "model-and-output-evaluation",
    summary:
      "Defining what good output means before shipping and measuring it with small, repeatable checks.",
    content:
      "This demo skill focuses on test design rather than leaderboard chasing. It is useful for teams deciding which new AI capabilities are worth deeper investment.",
    skillType: "analysis",
    heatLevel: "active",
    learningCost: "medium",
    tags: ["tag-observability", "tag-product-strategy"],
    relatedTechnologyIds: ["tech-rag-evals", "tech-slm-edge"],
    relatedKnowledgeIds: ["knowledge-evaluation-loops", "knowledge-feedback-loops"]
  },
  {
    id: "skill-scope-pilots",
    title: "AI Pilot Scoping",
    slug: "ai-pilot-scoping",
    summary:
      "Choosing use cases that are valuable enough to matter but narrow enough to learn from quickly.",
    content:
      "This demo skill is intentionally product-focused. It helps teams avoid confusing visible novelty with worthwhile investment.",
    skillType: "product",
    heatLevel: "active",
    learningCost: "low",
    tags: ["tag-product-strategy", "tag-workflow"],
    relatedTechnologyIds: ["tech-browser-agents", "tech-slm-edge", "tech-voice-runtime"],
    relatedKnowledgeIds: ["knowledge-feedback-loops", "knowledge-human-loop"]
  },
  {
    id: "skill-communication-ai",
    title: "AI-Assisted Communication Review",
    slug: "ai-assisted-communication-review",
    summary:
      "Using AI tools to turn screenshots, logs, and draft text into clearer engineering communication.",
    content:
      "This demo skill is relevant because many visible AI gains come from faster alignment rather than full automation. It pairs especially well with multimodal tools.",
    skillType: "communication",
    heatLevel: "emerging",
    learningCost: "low",
    tags: ["tag-multimodal", "tag-workflow"],
    relatedTechnologyIds: ["tech-multimodal-copilots", "tech-voice-runtime"],
    relatedKnowledgeIds: ["knowledge-feedback-loops", "knowledge-human-loop"]
  }
];
