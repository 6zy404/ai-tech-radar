import type { TechnologyItem } from "@/types/content";

export const technologyItems: TechnologyItem[] = [
  {
    id: "tech-mcp",
    title: "Model Context Protocol",
    slug: "model-context-protocol",
    summary:
      "A demo entry for the emerging protocol layer that standardizes how AI tools request context and capabilities.",
    content:
      "This mock record represents the idea that protocol-based tool access can reduce one-off integrations. It matters because teams can compare tools through a shared interface instead of rebuilding adapters every time.",
    type: "protocol",
    publishDate: "2026-04-10",
    sourceName: "Demo Radar Weekly",
    sourceUrl: "https://example.com/demo-radar/model-context-protocol",
    publisherName: "Open Tools Community",
    publisherType: "open-source-community",
    importanceLevel: "critical",
    status: "learn-first",
    tags: ["tag-ai-agents", "tag-workflow"],
    relatedKnowledgeIds: ["knowledge-api-contracts", "knowledge-tool-use"],
    relatedSkillIds: ["skill-tool-integration", "skill-agent-design"]
  },
  {
    id: "tech-browser-agents",
    title: "Browser Automation Agents",
    slug: "browser-automation-agents",
    summary:
      "A demo entry showing how browser-driven agents connect planning with real web tasks.",
    content:
      "Browser agents are useful to study because they expose practical failure modes: brittle selectors, missing state, and poor handoffs between reasoning and execution. This mock profile treats them as a visible new capability, not as production guidance.",
    type: "workflow",
    publishDate: "2026-04-09",
    sourceName: "Demo Product Brief",
    sourceUrl: "https://example.com/demo-radar/browser-agents",
    publisherName: "Automation Lab",
    publisherType: "startup",
    importanceLevel: "important",
    status: "watch",
    tags: ["tag-ai-agents", "tag-multimodal", "tag-workflow"],
    relatedKnowledgeIds: ["knowledge-human-loop", "knowledge-system-design"],
    relatedSkillIds: ["skill-agent-design", "skill-scope-pilots"]
  },
  {
    id: "tech-slm-edge",
    title: "On-device Small Language Models",
    slug: "on-device-small-language-models",
    summary:
      "A demo entry for compact models that shift some AI workloads from cloud to local environments.",
    content:
      "The value of local models is not only privacy. They also change latency, deployment, and fallback strategy decisions. This mock entry highlights why teams should understand where small local models outperform large remote ones.",
    type: "model",
    publishDate: "2026-04-07",
    sourceName: "Demo Field Notes",
    sourceUrl: "https://example.com/demo-radar/on-device-slm",
    publisherName: "Edge Compute Journal",
    publisherType: "media",
    importanceLevel: "important",
    status: "learn-first",
    tags: ["tag-on-device", "tag-product-strategy"],
    relatedKnowledgeIds: ["knowledge-model-sizing", "knowledge-latency-tradeoffs"],
    relatedSkillIds: ["skill-model-evaluation", "skill-scope-pilots"]
  },
  {
    id: "tech-rag-evals",
    title: "RAG Evaluation Dashboards",
    slug: "rag-evaluation-dashboards",
    summary:
      "A demo entry for tools that help teams inspect retrieval quality and answer faithfulness.",
    content:
      "Retrieval systems often look fine in demos and break in production. This mock item focuses on the recent wave of lightweight tools that make evaluation visible to product and engineering teams before launch.",
    type: "tool",
    publishDate: "2026-04-06",
    sourceName: "Demo Ops Digest",
    sourceUrl: "https://example.com/demo-radar/rag-evals",
    publisherName: "Quality Stack",
    publisherType: "startup",
    importanceLevel: "critical",
    status: "learn-first",
    tags: ["tag-retrieval", "tag-observability"],
    relatedKnowledgeIds: ["knowledge-rag-basics", "knowledge-evaluation-loops"],
    relatedSkillIds: ["skill-retrieval-tuning", "skill-model-evaluation"]
  },
  {
    id: "tech-agent-workbenches",
    title: "Agent Workbench Platforms",
    slug: "agent-workbench-platforms",
    summary:
      "A demo entry for platforms that bundle prompts, tools, logs, and experiments in one operator view.",
    content:
      "Workbenches matter because teams rarely fail from model quality alone. They fail from coordination overhead. This mock entry is included to show how platform products wrap many smaller practices into one operational surface.",
    type: "platform",
    publishDate: "2026-04-05",
    sourceName: "Demo Platform Review",
    sourceUrl: "https://example.com/demo-radar/agent-workbenches",
    publisherName: "TeamOps Cloud",
    publisherType: "big-tech",
    importanceLevel: "important",
    status: "watch",
    tags: ["tag-ai-agents", "tag-observability", "tag-workflow"],
    relatedKnowledgeIds: ["knowledge-system-design", "knowledge-evaluation-loops"],
    relatedSkillIds: ["skill-agent-design", "skill-tool-integration"]
  },
  {
    id: "tech-multimodal-copilots",
    title: "Multimodal Coding Copilots",
    slug: "multimodal-coding-copilots",
    summary:
      "A demo entry for coding tools that combine text, screenshots, and repository context.",
    content:
      "These tools are noteworthy because they reduce the gap between a bug report and an actionable change. This mock record frames them as a learning target for product teams deciding how AI changes development workflows.",
    type: "tool",
    publishDate: "2026-04-04",
    sourceName: "Demo Builder Notes",
    sourceUrl: "https://example.com/demo-radar/multimodal-copilots",
    publisherName: "Dev Productivity Review",
    publisherType: "media",
    importanceLevel: "important",
    status: "watch",
    tags: ["tag-multimodal", "tag-workflow"],
    relatedKnowledgeIds: ["knowledge-feedback-loops", "knowledge-tool-use"],
    relatedSkillIds: ["skill-tool-integration", "skill-communication-ai"]
  },
  {
    id: "tech-kg-assistants",
    title: "Knowledge-Graph Assistants",
    slug: "knowledge-graph-assistants",
    summary:
      "A demo entry for assistants that mix LLM reasoning with explicit graph relationships.",
    content:
      "Graph-backed assistants are interesting when loose semantic similarity is not enough. This mock entry demonstrates how new interfaces can still depend on older information architecture ideas.",
    type: "platform",
    publishDate: "2026-04-02",
    sourceName: "Demo Architecture Memo",
    sourceUrl: "https://example.com/demo-radar/kg-assistants",
    publisherName: "Structured Data Lab",
    publisherType: "research-lab",
    importanceLevel: "signal",
    status: "watch",
    tags: ["tag-knowledge-graph", "tag-ai-agents", "tag-retrieval"],
    relatedKnowledgeIds: ["knowledge-graph-thinking", "knowledge-rag-basics"],
    relatedSkillIds: ["skill-retrieval-tuning", "skill-agent-design"]
  },
  {
    id: "tech-voice-runtime",
    title: "Voice Agent Runtime",
    slug: "voice-agent-runtime",
    summary:
      "A demo entry for orchestration layers that combine speech, intent handling, and tool calls.",
    content:
      "Voice runtimes are included to show that the platform should track user interaction shifts, not only model releases. The mock data emphasizes operational concerns such as latency and handoff quality.",
    type: "platform",
    publishDate: "2026-04-01",
    sourceName: "Demo Interface Report",
    sourceUrl: "https://example.com/demo-radar/voice-runtime",
    publisherName: "Conversational Systems Group",
    publisherType: "startup",
    importanceLevel: "signal",
    status: "pilot-later",
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
