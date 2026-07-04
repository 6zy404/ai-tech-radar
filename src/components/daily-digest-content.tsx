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
  high_priority: "立即关注",
  watch: "值得跟踪",
  low_priority: "了解即可"
};

const priorityReasonCopy: Record<PriorityLevel, string> = {
  high_priority: "多项信号同时出现，这项技术值得尽早评估。",
  watch: "这一变化值得跟进，但仍需更多背景或验证。",
  low_priority: "可作背景了解，但今天还不够紧迫到需要优先处理。"
};

const technologyTypeLabels: Record<TechnologyType, string> = {
  platform: "平台",
  tool: "工具",
  model: "模型",
  protocol: "协议",
  workflow: "工作流"
};

const difficultyLabels: Record<ReadingDifficulty, string> = {
  beginner: "入门友好",
  intermediate: "进阶",
  advanced: "高级"
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

  return `适合 ${visibleAudience.join("、")}`;
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
    if (
      ![...references.values()].some((item) => item.sourceName === sourceName)
    ) {
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
          <span>为什么值得看</span>
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
              {intelligence.relatedSkillCount} 个技能 /{" "}
              {intelligence.relatedKnowledgeCount} 个概念
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
            查看信号
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
        <h2>来源参考</h2>
        <p>本期简报中已发布技术信号所代表的公开来源。</p>
      </div>
      {references.length > 0 ? (
        <div className="digest-source-list">
          {references.map((reference) => (
            <article key={reference.id} className="digest-source-chip">
              <h3>{reference.sourceName}</h3>
              <p>
                {[reference.publisherName, reference.publishDate]
                  .filter(Boolean)
                  .join(" - ") || "公开来源"}
              </p>
              {reference.sourceUrl ? (
                <a
                  className="action-link"
                  href={reference.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  打开来源
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">本期简报暂无可展示的公开来源参考。</p>
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
          <p className="eyebrow user-eyebrow">每日简报 · {digest.date}</p>
          <h1>{publicTitle}</h1>
          <p className="daily-digest-brief-header__subtitle">{publicSummary}</p>
          {previewNotice ? (
            <p className="daily-digest-brief-header__notice">{previewNotice}</p>
          ) : null}
        </div>
        <div className="daily-digest-meta-strip" aria-label="简报摘要">
          <span>{digest.date}</span>
          <span>{highPriorityTechnologies.length} 条立即关注</span>
          <span>{watchTechnologies.length} 条值得跟踪</span>
          <span>{sourceCount} 个来源</span>
        </div>
      </section>

      <section className="daily-digest-summary-panel">
        <p className="eyebrow user-eyebrow">今日概览</p>
        <p>
          这份简报整理了最值得优先关注的已发布信号、值得跟踪的变化，
          以及让今天的技术动向更易理解的技能与背景知识。
        </p>
      </section>

      <section className="daily-digest-section">
        <div className="daily-digest-section__header">
          <h2>今日立即关注</h2>
          <p>被评为最高优先级的已发布技术信号，编辑置顶的条目优先展示。</p>
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
          <p className="empty-state">本期简报未选入需要立即关注的信号。</p>
        )}
      </section>

      <section className="daily-digest-section">
        <div className="daily-digest-section__header daily-digest-section__header--secondary">
          <h2>值得跟踪</h2>
          <p>值得跟进的信号，但在成为立即优先项之前仍需更多背景或验证。</p>
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
          <p className="empty-state">本期简报未选入值得跟踪的条目。</p>
        )}
      </section>

      <DigestReferenceList
        title="值得关注的技能"
        description="帮助读者判断接下来该尝试、评估或学习什么的技能。"
        emptyText="本期简报暂未选入相关技能。"
        items={skills}
        hrefPrefix="/skills"
        linkLabel="查看技能"
      />

      <DigestReferenceList
        title="背景知识"
        description="解释今天所选变化背后背景的概念。"
        emptyText="本期简报暂未选入相关背景概念。"
        items={knowledge}
        hrefPrefix="/knowledge"
        linkLabel="查看概念"
      />

      <DigestSourceReferences
        digest={digest}
        technologies={selectedTechnologies}
      />

      {showDeliveryLinks ? (
        <section className="daily-digest-section daily-digest-feeds">
          <div className="daily-digest-section__header daily-digest-section__header--compact">
            <h2>订阅简报</h2>
            <p>
              稳定的公开订阅源仅包含已发布的每日简报，草稿和已归档简报不在其中。
            </p>
          </div>
          <div className="digest-feed-links">
            <Link href={rssFeedPath}>RSS 订阅源</Link>
            <Link href={jsonFeedPath}>JSON 订阅源</Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
