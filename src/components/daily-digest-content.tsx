import Link from "next/link";

import { MetadataRow } from "@/components/metadata-row";
import { TagList } from "@/components/tag-list";
import { getDigestTechnologyIntelligenceSummary } from "@/lib/content-intelligence";
import { jsonFeedPath, rssFeedPath } from "@/lib/digest-delivery";
import {
  getPublicDigestSummary,
  getPublicDigestTitle
} from "@/lib/public-copy";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import {
  getPriorityLevelClass,
  getPriorityLevelLabel,
  getPriorityUserSummary
} from "@/lib/ranking-display";
import {
  getEffectiveTechnologyMode,
  getLocalizedTechnologyText,
  type TechnologyContentMode
} from "@/lib/technology-localization";
import type {
  DailyDigest,
  KnowledgeItem,
  SkillItem,
  TechnologyItem,
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

function getTechnologyTags(
  technology: TechnologyItem,
  tags: TopicTag[]
): TopicTag[] {
  return technology.tags
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is TopicTag => Boolean(tag));
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
  const prioritySummary = getPriorityUserSummary(ranking, effectiveMode);
  const intelligence = getDigestTechnologyIntelligenceSummary(
    technology,
    ranking,
    prioritySummary
  );

  return (
    <article
      className={`digest-technology-card${
        compact ? " digest-technology-card--compact" : ""
      }`}
    >
      <div className="digest-technology-card__header">
        <span className={getPriorityLevelClass(ranking.priorityLevel)}>
          {getPriorityLevelLabel(ranking.priorityLevel, effectiveMode)}
        </span>
        <MetadataRow
          className="digest-technology-card__meta"
          items={[
            { value: technology.sourceName },
            { value: technology.publishDate }
          ]}
        />
      </div>
      <h3>
        <Link href={`/technologies/${technology.slug}`}>{title}</Link>
      </h3>
      <p>{summary}</p>
      <div className="digest-technology-card__reason">
        <span>为什么值得看</span>
        <p>{intelligence.whyItMatters ?? prioritySummary}</p>
      </div>
      {!compact ? (
        <div className="digest-technology-card__context">
          <span>{intelligence.relatedSkillCount} 个相关技能</span>
          <span>{intelligence.relatedKnowledgeCount} 个背景知识</span>
          {intelligence.audience.slice(0, 2).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
      <TagList tags={getTechnologyTags(technology, tags)} limit={compact ? 2 : 3} />
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
  hrefPrefix
}: {
  title: string;
  description: string;
  emptyText: string;
  items: T[];
  hrefPrefix: string;
}) {
  return (
    <section className="digest-reference-section">
      <div className="section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {items.length > 0 ? (
        <div className="digest-reference-grid">
          {items.map((item) => (
            <article key={item.id} className="digest-reference-card">
              <h3>
                <Link href={`${hrefPrefix}/${item.slug}`}>{item.title}</Link>
              </h3>
              <p>{item.summary}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">{emptyText}</p>
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

  return (
    <div className="daily-digest">
      <section className="daily-digest-hero">
        <div>
          <p className="eyebrow user-eyebrow">每日技术简报</p>
          <h1>{publicTitle}</h1>
          <p>{publicSummary}</p>
          {previewNotice ? (
            <p className="daily-digest-hero__notice">{previewNotice}</p>
          ) : null}
        </div>
        <div className="daily-digest-hero__stats">
          <span>{digest.date}</span>
          <strong>{highPriorityTechnologies.length}</strong>
          <span>立即关注</span>
          <strong>{watchTechnologies.length}</strong>
          <span>值得跟踪</span>
        </div>
      </section>

      <section className="daily-digest-section">
        <div className="section-heading">
          <h2>今日立即关注</h2>
          <p>
            已发布技术信号中优先级最高的内容，编辑固定的条目会优先展示。
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
            今天还没有立即关注条目。可以先浏览已发布技术信号。
          </p>
        )}
      </section>

      <section className="daily-digest-section">
        <div className="section-heading">
          <h2>值得跟踪</h2>
          <p>
            值得持续观察、但仍需要更多上下文或验证的技术变化。
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
            这期简报没有选择跟踪级条目。
          </p>
        )}
      </section>

      <DigestReferenceList
        title="需要关注的技能"
        description="这些能力可以帮助你判断哪些技术值得试用、评估或继续学习。"
        emptyText="这期简报还没有关联技能，可以先从上方技术条目进入。"
        items={skills}
        hrefPrefix="/skills"
      />

      <DigestReferenceList
        title="背景知识"
        description="理解今日技术变化所需的基础概念和上下文。"
        emptyText="这期简报还没有关联背景知识，可以先从上方技术条目进入。"
        items={knowledge}
        hrefPrefix="/knowledge"
      />

      <section className="daily-digest-section daily-digest-sources">
        <div className="section-heading">
          <h2>来源参考</h2>
          <p>
            这期简报中已发布技术条目对应的公开来源。
          </p>
        </div>
        {digest.sourceNames.length > 0 ? (
          <div className="tag-row">
            {digest.sourceNames.map((sourceName) => (
              <span key={sourceName} className="info-pill info-pill--subtle">
                {sourceName}
              </span>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            这期简报还没有来源名称。
          </p>
        )}
      </section>

      {showDeliveryLinks ? (
        <section className="daily-digest-section daily-digest-delivery-links">
          <div className="section-heading">
            <h2>订阅简报</h2>
            <p>
              公开 feed 只包含已发布的每日简报，草稿和归档内容不会进入 feed。
            </p>
          </div>
          <div className="digest-delivery-link-row">
            <Link href={rssFeedPath} className="action-link">
              RSS feed
            </Link>
            <Link href={jsonFeedPath} className="action-link">
              JSON feed
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
