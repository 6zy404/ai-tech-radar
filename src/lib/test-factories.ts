import type {
  TechnologyItem,
  TechnologyWorkspaceRecord
} from "@/types/content";

/**
 * Test-only factories that build fully-populated domain records, so individual
 * tests can override only the fields they care about. Not imported by app code.
 */

export function makeTechnologyItem(
  overrides: Partial<TechnologyItem> = {}
): TechnologyItem {
  return {
    id: "tech-1",
    title: { original: "Example Technology" },
    slug: "example-technology",
    summary: { original: "A concise summary of the example technology." },
    content: { original: "Longer body content explaining the example technology." },
    type: "tool",
    publishDate: "2026-05-20",
    sourceName: "Example Source",
    sourceUrl: "https://example.com/post",
    sourceLanguage: "en",
    translationStatus: "not_needed",
    publisherName: "Example Publisher",
    publisherType: "big-tech",
    importanceLevel: "critical",
    status: "draft",
    tags: ["ai", "tooling"],
    relatedKnowledgeIds: ["knowledge-1"],
    relatedSkillIds: ["skill-1"],
    ...overrides
  };
}

export function makeWorkspaceRecord(
  overrides: Partial<TechnologyWorkspaceRecord> = {}
): TechnologyWorkspaceRecord {
  const { sourceReferences: _ignored, ...base } = makeTechnologyItem();

  return {
    ...base,
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:0