import Link from "next/link";

import { TagList } from "@/components/tag-list";
import { getDigestTechnologyIntelligenceSummary } from "@/lib/content-intelligence";
import { jsonFeedPath, rssFeedPath } from "@/lib/digest-delivery";
import {
  getPublicDigestSummary,
  getPublicDigestTitle
} from "@/lib/public-copy";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import { getPriorityLevelClass } from "@/lib/ranking-display";
import {
  getEffectiveTechnologyMode,
  getLocalizedTechnologyText,
  type TechnologyContentMode
} from "@/lib/technology-localization";
import type {
  DailyDigest,
  KnowledgeItem,
  PriorityLevel,
  ReadingDifficulty,
  SkillItem,
  TechnologyItem,
  TechnologySourceReference,
  TechnologyType,
  TopicTag
} from "@/types/content";

interface DailyDigestContentProps {
  digest: DailyDigest;
  highPriorityTechnologies: TechnologyItem[];
  watchTechnologies: TechnologyItem[];
  skills: SkillItem[];
  knowledge: KnowledgeItem[];
  tags: TopicTag[];
  previewNotice?: string;
  showDeliveryLinks?: boolean;
}

interface DigestTechnologyCardProps {
  technology: TechnologyItem;
  tags: TopicTag[];
  compact?: boolean;
}

interface DigestSourceReference extends TechnologySourceReference {
  id: string;
}

const priorityLabels: Record<PriorityLevel, string> = {
  high_priority: "Immediate attention",
  watch: "Worth tracking",
  low_priority: "Good to know"
};

const priorityReasonCopy: Record<PriorityLevel, string> = {
  high_priority:
    "Multiple signals line up, so this technology is worth evaluating early.",
  watch:
    "This change is worth following, but still needs more context or validation.",
  low_priority: "Useful background, but not urgent enough to prioritize today."
};

const technologyTypeLabels: Record<TechnologyType, string> = {
  platform: "Platform",
  tool: "Tool",
  model: "Model",
  protocol: "Protocol",
  workflow: "Workflow"
};

const difficultyLabels: Record<ReadingDifficulty, string> = {
  beginner: "Beginner friendly",
  intermediate: "Intermediate",
  advanced: "Advanced"
};

function getTechnologyTags(
  technology: TechnologyItem,
  tags: TopicTag[]
): TopicTag[] {
  return technology.tags
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is TopicTag => Boolean(tag));
}

function compactText(value: string, maxLength: number): string {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
}

function getAudienceLine(audience: string[]): string | undefined {
  const visibleAudience = audience.filter(Boolean).slice(0, 3);

  if (visibleAudience.length === 0) {
    return undefined;
  }

  return `Useful for ${visibleAudience.join(", ")}`;
}

function getDigestSourceReferences(
  digest: DailyDigest,
  technologies: TechnologyItem[]
): DigestSourceReference[] {
  const references = new Map<string, DigestSourceReference>();

  for (const technology of technologies) {
    const technologyReferences =
      technology.sourceReferences && technology.sourceReferences.length > 0
        ? technology.sourceReferences
        : [
            {
              sourceName: technology.sourceName,
              sourceUrl: technology.sourceUrl,
              publisherName: technology.publisherName,
              publishDate: technology.publishDate
            }
          ];

    for (const reference of technologyReferences) {
      const key = reference.sourceUrl || reference.sourceName;
      references.set(key, {
        id: key,
        ...reference
      });
    }
  }

  for (const sourceName of digest.sourceNames) {
    if (![...references.values()].some((item) => item.sourceName === sourceName)) {
      references.set(sourceName, {
        id: sourceName,
        sourceName,
        sourceUrl: ""
      });
    }
  }

  return [...references.values()];
}

function DigestTechnologyCard({
  technology,
  tags,
  compact = false
}: DigestTechnologyCardProps) {
  const mode: TechnologyContentMode = "zh";
  const effectiveMode = getEffectiveTechnologyMode(
    technology,
    mode,
    compact ? "preview" : "detail"
  );
  const ranking = evaluateTechnologyPriority(technology);
  const title = getLocalizedTechnologyText(
    technology.title,
    effectiveMode,
    technology.sourceLanguage
  );
  const summary = getLocalizedTechnologyText(
    technology.summary,
    effectiveMode,
    technology.sourceLanguage
  );
  const intelligence = getDigestTechnologyIntelligenceSummary(
    technology,
    ranking,
    priorityReasonCopy[ranking.priorityLevel]
  );
  const whyItMatters = compactText(
    intelligence.whyItMatters ?? priorityReasonCopy[ranking.priorityLevel],
    compact ? 130 : 180
  );
  const audienceLine = getAudienceLine(intelligence.audience);
  const difficulty = technology.readingDifficulty
    ? difficultyLabels[technology.readingDifficulty]
    : undefined;

  return (
    <article
      className={`digest-technology-card${
        compact ? " digest-technology-card--compact" : ""
      }${compact ? "" : " digest-technology-card--featured"}`}
    >
      <div className="digest-technology-card__topline">
        <div className="digest-technology-card__badges">
          <span className="info-pill info-pill--subtle">
            {technologyTypeLabels[technology.type]}
          </span>
          <span className={getPriorityLevelClass(ranking.priorityLevel)}>
            {priorityLabels[ranking.priorityLevel]}
          </span>
        </div>
      </div>

      <div className="digest-technology-card__body">
        <h3>
          <Link href={`/technologies/${technology.slug}`}>{title}</Link>
        </h3>
        <p className="digest-technology-card__summary">
          {compactText(summary, compact ? 140 : 190)}
        </p>
        <div className="digest-technology-card__reason">
          <span>Why it matters</span>
          <p>{whyItMatters}</p>
        </div>
        {audienceLine ? (
          <p className="digest-technology-card__audience">{audienceLine}</p>
        ) : null}
      </div>

      <div className="digest-technology-card__footer">
        <div className="digest-technology-card__meta-line">
          <span>{technology.sourceName}</span>
          <span>{technology.publishDate}</span>
          {difficulty ? <span>{difficulty}</span> : null}
          {!compact ? (
            <span>
              {intelligence.relatedSkillCount} skills /{" "}
              {intelligence.relatedKnowledgeCount} concepts
            </span>
          ) : null}
        </div>
        <div className="digest-technology-card__actions">
          <TagList
            tags={getTechnologyTags(technology, tags)}
            limit={compact ? 2 : 4}
          />
          <Link
            className="action-link digest-technology-card__open"
            href={`/technologies/${technology.slug}`}
          >
            Open signal
          </Link>
        </div>
      </div>
    </article>
  );
}

function DigestReferenceList<
  T extends { id: string; title: string; slug: string; summary: string }
>({
  title,
  description,
  emptyText,
  items,
  hrefPrefix,
  linkLabel
}: {
  title: string;
  description: string;
  emptyText: string;
  items: T[];
  hrefPrefix: string;
  linkLabel: string;
}) {
  return (
    <section className="digest-reference-section">
      <div className="daily-digest-section__header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {items.length > 0 ? (
        <div className="digest-reference-list">
          {items.map((item) => (
            <article key={item.id} className="digest-reference-item">
              <div>
                <h3>
                  <Link href={`${hrefPrefix}/${item.slug}`}>{item.title}</Link>
                </h3>
                <p>{item.summary}</p>
              </div>
              <Link
                className="action-link digest-reference-item__link"
                href={`${hrefPrefix}/${item.slug}`}
              >
                {linkLabel}
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">{emptyText}</p>
      )}
    </section>
  );
}

function DigestSourceReferences({
  digest,
  technologies
}: {
  digest: DailyDigest;
  technologies: TechnologyItem[];
}) {
  const references = getDigestSourceReferences(digest, technologies);

  return (
    <section className="daily-digest-section daily-digest-sources">
      <div className="daily-digest-section__header daily-digest-section__header--compact">
        <h2>Source references</h2>
        <p>
          Public sources represented by the published technology signals in this
          digest.
        </p>
      </div>
      {references.length > 0 ? (
        <div className="digest-source-list">
          {references.map((reference) => (
            <article key={reference.id} className="digest-source-chip">
              <h3>{reference.sourceName}</h3>
              <p>
                {[reference.publisherName, reference.publishDate]
                  .filter(Boolean)
                  .join(" - ") || "Public source"}
              </p>
              {reference.sourceUrl ? (
                <a
                  className="action-link"
                  href={reference.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open source
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">
          No public source references are available for this digest yet.
        </p>
      )}
    </section>
  );
}

export function DailyDigestContent({
  digest,
  highPriorityTechnologies,
  watchTechnologies,
  skills,
  knowledge,
  tags,
  previewNotice,
  showDeliveryLinks = false
}: DailyDigestContentProps) {
  const publicTitle = getPublicDigestTitle(digest);
  const publicSummary = getPublicDigestSummary(digest);
  const selectedTechnologies = [
    ...highPriorityTechnologies,
    ...watchTechnologies
  ];
  const sourceCount = getDigestSourceReferences(
    digest,
    selectedTechnologies
  ).length;

  return (
    <div className="daily-digest daily-digest-reading">
      <section className="daily-digest-brief-header">
        <div className="daily-digest-brief-header__copy">
          <p className="eyebrow user-eyebrow">Daily Digest · {digest.date}</p>
          <h1>{publicTitle}</h1>
          <p className="daily-digest-brief-header__subtitle">
            {publicSummary}
          </p>
          {previewNotice ? (
            <p className="daily-digest-brief-header__notice">
              {previewNotice}
            </p>
          ) : null}
        </div>
        <div className="daily-digest-meta-strip" aria-label="Digest summary">
          <span>{digest.date}</span>
          <span>{highPriorityTechnologies.length} immediate</span>
          <span>{watchTechnologies.length} tracking</span>
          <span>{sourceCount} sources</span>
        </div>
      </section>

      <section className="daily-digest-summary-panel">
        <p className="eyebrow user-eyebrow">Today summary</p>
        <p>
          This brief organizes the published signals that deserve attention
          first, the changes worth tracking, and the skills and background
          concepts that make today&apos;s technology movement easier to read.
        </p>
      </section>

      <section className="daily-digest-section">
        <div className="daily-digest-section__header">
          <h2>Today&apos;s immediate attention</h2>
          <p>
            Published technology signals ranked as the highest priority, with
            any editor-pinned items shown first.
          </p>
        </div>
        {highPriorityTechnologies.length > 0 ? (
          <div className="digest-technology-list digest-technology-list--featured">
            {highPriorityTechnologies.map((technology) => (
              <DigestTechnologyCard
                key={technology.id}
                technology={technology}
                tags={tags}
              />
            ))}
          </div>
        ) : (
          <p className="empty-state">
            No immediate-attention signals were selected for this digest.
          </p>
        )}
      </section>

      <section className="daily-digest-section">
        <div className="daily-digest-section__header daily-digest-section__header--secondary">
          <h2>Worth tracking</h2>
          <p>
            Signals that are useful to follow, but still need more context or
            validation before becoming immediate priorities.
          </p>
        </div>
        {watchTechnologies.length > 0 ? (
          <div className="digest-technology-list">
            {watchTechnologies.map((technology) => (
              <DigestTechnologyCard
                key={technology.id}
                technology={technology}
                tags={tags}
                compact
              />
            ))}
          </div>
        ) : (
          <p className="empty-state">
            No watch-level items were selected for this digest.
          </p>
        )}
      </section>

      <DigestReferenceList
        title="Skills to pay attention to"
        description="Skills that help readers judge what to try, evaluate, or learn next."
        emptyText="No related skills were selected for this digest yet."
        items={skills}
        hrefPrefix="/skills"
        linkLabel="View skill"
      />

      <DigestReferenceList
        title="Background knowledge"
        description="Concepts that explain the background behind today's selected changes."
        emptyText="No related background concepts were selected for this digest yet."
        items={knowledge}
        hrefPrefix="/knowledge"
        linkLabel="View concept"
      />

      <DigestSourceReferences
        digest={digest}
        technologies={selectedTechnologies}
      />

      {showDeliveryLinks ? (
        <section className="daily-digest-section daily-digest-feeds">
          <div className="daily-digest-section__header daily-digest-section__header--compact">
            <h2>Follow the digest</h2>
            <p>
              Stable public feeds include published daily digests only. Draft
              and archived digests are excluded.
            </p>
          </div>
          <div className="digest-feed-links">
            <Link href={rssFeedPath}>RSS feed</Link>
            <Link href={jsonFeedPath}>JSON feed</Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
