import type { KnowledgeItem } from "@/types/content";

export const knowledgeItems: KnowledgeItem[] = [
  {
    id: "knowledge-api-contracts",
    title: "API Contracts and Interface Boundaries",
    slug: "api-contracts-and-interface-boundaries",
    summary:
      "Stable contracts matter when AI systems call tools, chain services, or exchange structured context.",
    content:
      "This classic concept explains why explicit inputs and outputs improve reliability. It remains relevant even when the interface is wrapped in an agent framework.",
    category: "software-architecture",
    difficulty: "foundation",
    tags: ["tag-workflow"],
    relatedTechnologyIds: ["tech-mcp"],
    relatedSkillIds: ["skill-tool-integration"]
  },
  {
    id: "knowledge-tool-use",
    title: "Tool Use and Function Calling",
    slug: "tool-use-and-function-calling",
    summary:
      "The older idea behind many new agent systems: separate reasoning from action and validate both.",
    content:
      "Understanding tool use makes it easier to compare protocols, SDKs, and agent products without being distracted by branding. It is a key bridge between new tools and lasting patterns.",
    category: "software-architecture",
    difficulty: "intermediate",
    tags: ["tag-ai-agents", "tag-workflow"],
    relatedTechnologyIds: ["tech-mcp", "tech-multimodal-copilots"],
    relatedSkillIds: ["skill-agent-design", "skill-tool-integration"]
  },
  {
    id: "knowledge-rag-basics",
    title: "Retrieval-Augmented Generation Basics",
    slug: "retrieval-augmented-generation-basics",
    summary:
      "Why external knowledge retrieval changes answer quality, freshness, and trust boundaries.",
    content:
      "RAG remains a foundational concept because it clarifies when model memory is insufficient. Teams can use it to reason about why new retrieval products matter or fail.",
    category: "data",
    difficulty: "foundation",
    tags: ["tag-retrieval"],
    relatedTechnologyIds: ["tech-rag-evals", "tech-kg-assistants"],
    relatedSkillIds: ["skill-retrieval-tuning"]
  },
  {
    id: "knowledge-evaluation-loops",
    title: "Evaluation Loops",
    slug: "evaluation-loops",
    summary:
      "A classic operational habit: define expected outcomes, observe failures, and tighten the loop.",
    content:
      "Evaluation loops are not unique to AI, which is exactly why they matter. This concept helps teams avoid treating new model behavior as unknowable magic.",
    category: "operations",
    difficulty: "intermediate",
    tags: ["tag-observability"],
    relatedTechnologyIds: ["tech-rag-evals", "tech-agent-workbenches"],
    relatedSkillIds: ["skill-model-evaluation"]
  },
  {
    id: "knowledge-system-design",
    title: "System Design Tradeoffs",
    slug: "system-design-tradeoffs",
    summary:
      "Latency, reliability, cost, and control still apply when the product surface is AI-driven.",
    content:
      "This concept connects old architecture thinking to new agent platforms. It helps readers ask what a workflow should own versus what a platform should abstract away.",
    category: "software-architecture",
    difficulty: "intermediate",
    tags: ["tag-workflow", "tag-product-strategy"],
    relatedTechnologyIds: ["tech-browser-agents", "tech-agent-workbenches"],
    relatedSkillIds: ["skill-agent-design"]
  },
  {
    id: "knowledge-human-loop",
    title: "Human-in-the-Loop Review",
    slug: "human-in-the-loop-review",
    summary:
      "Human checkpoints remain essential when outputs affect customers, operations, or public communication.",
    content:
      "New tools may automate more steps, but review design still determines trust. This concept explains how to place human decisions where they add the most value.",
    category: "operations",
    difficulty: "foundation",
    tags: ["tag-product-strategy", "tag-workflow"],
    relatedTechnologyIds: ["tech-browser-agents", "tech-voice-runtime"],
    relatedSkillIds: ["skill-scope-pilots", "skill-communication-ai"]
  },
  {
    id: "knowledge-graph-thinking",
    title: "Graph Thinking for Knowledge Systems",
    slug: "graph-thinking-for-knowledge-systems",
    summary:
      "Modeling concepts and links explicitly makes some kinds of reasoning easier to inspect and maintain.",
    content:
      "This classic knowledge-organization concept is useful again because AI products increasingly need explainable relationships, not only nearest-neighbor similarity.",
    category: "data",
    difficulty: "advanced",
    tags: ["tag-knowledge-graph", "tag-retrieval"],
    relatedTechnologyIds: ["tech-kg-assistants"],
    relatedSkillIds: ["skill-retrieval-tuning"]
  },
  {
    id: "knowledge-model-sizing",
    title: "Model Sizing and Constraint Matching",
    slug: "model-sizing-and-constraint-matching",
    summary:
      "Choose model size based on latency, privacy, cost, and task complexity rather than prestige alone.",
    content:
      "This concept helps teams understand why smaller models can be strategically better in edge or high-volume environments. It is a useful lens for local-model decisions.",
    category: "machine-learning",
    difficulty: "intermediate",
    tags: ["tag-on-device", "tag-product-strategy"],
    relatedTechnologyIds: ["tech-slm-edge"],
    relatedSkillIds: ["skill-model-evaluation"]
  },
  {
    id: "knowledge-latency-tradeoffs",
    title: "Latency Tradeoffs in Interactive Systems",
    slug: "latency-tradeoffs-in-interactive-systems",
    summary:
      "Interaction design changes when users must wait for speech, retrieval, or long multi-step actions.",
    content:
      "This classic systems lesson becomes visible again in voice and on-device AI products. Teams need it to reason about responsiveness, batching, and fallback behavior.",
    category: "software-architecture",
    difficulty: "intermediate",
    tags: ["tag-on-device", "tag-multimodal"],
    relatedTechnologyIds: ["tech-slm-edge", "tech-voice-runtime"],
    relatedSkillIds: ["skill-scope-pilots"]
  },
  {
    id: "knowledge-feedback-loops",
    title: "Feedback Loops and Team Learning",
    slug: "feedback-loops-and-team-learning",
    summary:
      "Small, visible loops help teams learn faster than large launches with vague success criteria.",
    content:
      "This concept matters because many AI initiatives fail from slow learning cadence, not weak models. It supports both communication practices and pilot scoping.",
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
