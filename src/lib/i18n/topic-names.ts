import type { TopicTag } from "@/types/content";
import type { Locale } from "@/lib/i18n/locale";

/**
 * English names for the topic tags, written by hand. Topics are the site's
 * own vocabulary, like the relation types and the radar rings, so the English
 * interface names them in English; the items filed under them keep their own
 * language. Keyed by tag id — `topic-names.test.ts` fails when a tag in
 * `src/data/tags.ts` has no entry here.
 */
export const englishTopicNames: Record<
  string,
  { name: string; description: string }
> = {
  "tag-ai-agents": {
    name: "AI agents",
    description: "Tools and patterns for multi-step AI systems that use tools."
  },
  "tag-retrieval": {
    name: "Retrieval",
    description: "Search, grounding and context-assembly workflows."
  },
  "tag-multimodal": {
    name: "Multimodal",
    description:
      "Interfaces that combine text, images, speech or browser actions."
  },
  "tag-workflow": {
    name: "Workflow",
    description: "Operating patterns that make AI tools usable by real teams."
  },
  "tag-on-device": {
    name: "On-device AI",
    description:
      "Capable models running locally on laptops, phones or edge devices."
  },
  "tag-observability": {
    name: "Observability",
    description: "Tracing, monitoring and post-incident review in production."
  },
  "tag-knowledge-graph": {
    name: "Knowledge graphs",
    description:
      "Structured relations that connect concepts, entities and tasks."
  },
  "tag-product-strategy": {
    name: "Product strategy",
    description:
      "Ways to decide what is worth learning, shipping and piloting first."
  },
  "tag-inference": {
    name: "Inference & deployment",
    description:
      "Inference engines, deployment shapes and cost optimisation for large models."
  },
  "tag-frontier-models": {
    name: "Frontier models",
    description:
      "Generational updates of flagship models, their limits and price-performance."
  },
  "tag-ai-safety": {
    name: "Safety & alignment",
    description:
      "Safety incidents, red-teaming and alignment methods for models and agents, and controls on cyber capabilities."
  },
  "tag-open-weights": {
    name: "Open-weight models",
    description:
      "Releases of models with public weights, their licences and the open ecosystem."
  },
  "tag-agent-infra": {
    name: "Agent runtimes & protocols",
    description:
      "Runtimes, orchestration frameworks, sandboxes and protocols such as MCP: where agents run and how they reach tools."
  },
  "tag-ai-for-science": {
    name: "AI for science",
    description:
      "AI applied to mathematics, biomedicine and other research, and AI that speeds up research itself."
  },
  "tag-coding-agents": {
    name: "Coding agents",
    description:
      "Agents that write, review and change code, and what they change in engineering practice."
  },
  "tag-model-pricing": {
    name: "Pricing & cost",
    description:
      "Model pricing, compute and token costs, and what a task really costs."
  },
  "tag-benchmarks": {
    name: "Benchmarks & evaluation",
    description:
      "How benchmarks are designed and how far to trust them, third-party evaluations and how they are scored."
  },
  "tag-training": {
    name: "Training & post-training",
    description:
      "Pre-training, reinforcement learning, fine-tuning and synthetic data, and the frameworks and environments for them."
  },
  "tag-efficient-inference": {
    name: "Quantisation & speculative decoding",
    description:
      "Quantisation, speculative decoding and other ways to make a model use less memory and generate faster."
  }
};

/** The tag as the interface language names it; unknown ids keep their name. */
export function localizeTag(tag: TopicTag, locale: Locale): TopicTag {
  if (locale === "zh") {
    return tag;
  }

  const english = englishTopicNames[tag.id];

  return english ? { ...tag, ...english } : tag;
}

export function localizeTags(tags: TopicTag[], locale: Locale): TopicTag[] {
  return locale === "zh" ? tags : tags.map((tag) => localizeTag(tag, locale));
}
