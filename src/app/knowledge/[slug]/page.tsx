import { notFound } from "next/navigation";

import { RelationList } from "@/components/relation-list";
import { TagList } from "@/components/tag-list";
import { UserPageShell } from "@/components/user-page-shell";
import {
  buildRelationItems,
  getAllKnowledge,
  getKnowledgeBySlug,
  getTagsByIds
} from "@/lib/content";
import type {
  DifficultyLevel,
  KnowledgeCategory,
  RelationListItem
} from "@/types/content";

interface KnowledgeDetailPageProps {
  params: Promise<{ slug: string }>;
}

const categoryLabels: Record<KnowledgeCategory, string> = {
  "machine-learning": "Machine learning",
  "software-architecture": "Software architecture",
  data: "Data",
  "product-thinking": "Product thinking",
  operations: "Operations"
};

const difficultyLabels: Record<DifficultyLevel, string> = {
  foundation: "Foundation",
  intermediate: "Intermediate",
  advanced: "Advanced"
};

function formatRelationType(
  relationType: RelationListItem["relationType"]
): string {
  return relationType.split("-").join(" ");
}

function getConceptMatter(category: KnowledgeCategory): string {
  const categoryCopy: Record<KnowledgeCategory, string> = {
    "machine-learning":
      "This concept helps readers separate model behavior, evaluation limits, and practical constraints before judging a new AI signal.",
    "software-architecture":
      "This concept helps readers see the interface boundaries and system tradeoffs behind a new tool or platform change.",
    data: "This concept helps readers understand how retrieval, freshness, trust, and data movement shape AI product quality.",
    "product-thinking":
      "This concept helps readers translate technical change into adoption choices, scoping decisions, and product risks.",
    operations:
      "This concept helps readers understand review loops, failure visibility, and rollout discipline when AI systems reach real users."
  };

  return categoryCopy[category];
}

function getLearningSteps(difficulty: DifficultyLevel): string[] {
  const sharedSteps = [
    "Read the concept summary before opening the related technology signals.",
    "Open one linked signal and identify where the concept appears in the product or engineering change.",
    "Pair the concept with one related skill to decide what to evaluate next."
  ];

  if (difficulty === "advanced") {
    return [
      ...sharedSteps,
      "Use the concept to compare longer-term architecture, data, or strategy tradeoffs."
    ];
  }

  if (difficulty === "intermediate") {
    return [
      ...sharedSteps,
      "Use the concept to compare implementation choices and operational consequences."
    ];
  }

  return sharedSteps;
}

export function generateStaticParams() {
  return getAllKnowledge().map((item) => ({ slug: item.slug }));
}

export default async function KnowledgeDetailPage({
  params
}: KnowledgeDetailPageProps) {
  const { slug } = await params;
  const knowledge = getKnowledgeBySlug(slug);

  if (!knowledge) {
    notFound();
  }

  const relatedTechnologies = buildRelationItems({
    fromId: knowledge.id,
    fromType: "knowledge",
    targetType: "technology",
    targetIds: knowledge.relatedTechnologyIds,
    defaultNote: "This published signal depends on this background concept."
  });

  const relatedSkills = buildRelationItems({
    fromId: knowledge.id,
    fromType: "knowledge",
    targetType: "skill",
    targetIds: knowledge.relatedSkillIds,
    defaultNote: "This skill becomes easier to practice with this concept."
  });

  const tags = getTagsByIds(knowledge.tags);
  const learningSteps = getLearningSteps(knowledge.difficulty);

  return (
    <UserPageShell
      title={knowledge.title}
      description={knowledge.summary}
      sectionLabel="Background Knowledge"
      showHeader={false}
      className="skill-detail-page knowledge-detail-page"
    >
      <div className="skill-detail-layout">
        <main className="skill-detail-main">
          <section className="skill-detail-hero">
            <p className="eyebrow user-eyebrow">
              {categoryLabels[knowledge.category]}
            </p>
            <h1>{knowledge.title}</h1>
            <p>{knowledge.summary}</p>
            {tags.length > 0 ? <TagList tags={tags} limit={4} /> : null}
          </section>

          {knowledge.content ? (
            <section className="skill-detail-section skill-detail-section--lead">
              <h2>What this concept means</h2>
              <p>{knowledge.content}</p>
            </section>
          ) : null}

          <section className="skill-detail-section">
            <h2>Why this concept matters</h2>
            <p>{getConceptMatter(knowledge.category)}</p>
          </section>

          <RelationList
            className="skill-detail-section"
            title="Technology signals explained by this concept"
            description="These published signals are easier to understand when this concept is clear."
            emptyText="No published technology signals reference this concept yet."
            items={relatedTechnologies}
            linkLabel="Open related signal"
            formatRelationType={formatRelationType}
          />

          <RelationList
            className="skill-detail-section"
            title="Skills that use this concept"
            description="These practical skills depend on the background model described here."
            emptyText="No skills are linked to this concept yet."
            items={relatedSkills}
            linkLabel="View skill"
            formatRelationType={formatRelationType}
          />

          <section className="skill-detail-section">
            <h2>How to continue learning</h2>
            <ol className="skill-detail-steps">
              {learningSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        </main>

        <aside className="skill-detail-aside" aria-label="Knowledge summary">
          <section className="skill-detail-aside-card">
            <p className="eyebrow user-eyebrow">Knowledge profile</p>
            <h2>{knowledge.title}</h2>
            <dl className="skill-detail-profile">
              <div>
                <dt>Category</dt>
                <dd>{categoryLabels[knowledge.category]}</dd>
              </div>
              <div>
                <dt>Difficulty</dt>
                <dd>{difficultyLabels[knowledge.difficulty]}</dd>
              </div>
              <div>
                <dt>Technology links</dt>
                <dd>{relatedTechnologies.length}</dd>
              </div>
              <div>
                <dt>Skill links</dt>
                <dd>{relatedSkills.length}</dd>
              </div>
            </dl>
          </section>

          {tags.length > 0 ? (
            <section className="skill-detail-aside-card">
              <p className="eyebrow user-eyebrow">Topics</p>
              <TagList tags={tags} limit={4} />
            </section>
          ) : null}

          <section className="skill-detail-aside-card">
            <p className="eyebrow user-eyebrow">Reading path</p>
            <h2>How to use this page</h2>
            <p>
              Start with the concept, open one related signal, then use the
              linked skills to decide what to evaluate next.
            </p>
          </section>
        </aside>
      </div>
    </UserPageShell>
  );
}
