import Link from "next/link";

import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { TagList } from "@/components/tag-list";
import { UnbreakableTitle } from "@/components/unbreakable-title";
import { UserPageShell } from "@/components/user-page-shell";
import {
  getReadingDifficultyLabel,
  getTechnologyAudience,
  getTechnologyWhyItMatters
} from "@/lib/content-intelligence";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTags,
  getAllTechnologies
} from "@/lib/content";
import { compactText } from "@/lib/compact-text";
import { getLatestPublishedDailyDigest } from "@/lib/digest-workflow";
import { digestCardSummaryLength } from "@/lib/digest-card-summary";
import { getDailyDigestRenderData } from "@/lib/digest-view";
import {
  getPublicDigestSummaryPlainText,
  getPublicDigestTitle
} from "@/lib/public-copy";
import { getLatestPublicNewsItems, newsDisclaimer } from "@/lib/news";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import {
  getPriorityLevelLabel,
  getPriorityUserSummary
} from "@/lib/ranking-display";
import {
  getEffectiveTechnologyMode,
  getLocalizedTechnologyText
} from "@/lib/technology-localization";
import type {
  DifficultyLevel,
  KnowledgeItem,
  SkillItem,
  SkillType,
  TechnologyItem,
  TopicTag
} from "@/types/content";

export const dynamic = "force-dynamic";

const skillTypeLabels: Record<SkillType, string> = {
  engineering: "工程落地",
  analysis: "评估与分析",
  product: "产品判断",
  operations: "运维与落地",
  communication: "团队沟通"
};

const difficultyLabels: Record<DifficultyLevel, string> = {
  foundation: "基础",
  intermediate: "进阶",
  advanced: "高级"
};

function getPublicTechnologyTitle(technology: TechnologyItem): string {
  const mode = getEffectiveTechnologyMode(technology, "zh", "preview");

  return getLocalizedTechnologyText(
    technology.title,
    mode,
    technology.sourceLanguage
  );
}

function getPublicTechnologySummary(technology: TechnologyItem): string {
  const mode = getEffectiveTechnologyMode(technology, "zh", "preview");

  return getLocalizedTechnologyText(
    technology.summary,
    mode,
    technology.sourceLanguage
  );
}

function HomeTechnologyCard({ technology }: { technology: TechnologyItem }) {
  const ranking = evaluateTechnologyPriority(technology);
  const summary = getPublicTechnologySummary(technology);
  const whyItMatters =
    getTechnologyWhyItMatters(
      technology,
      getPriorityUserSummary(ranking, "zh")
    ) ?? summary;
  const audience = getTechnologyAudience(technology).slice(0, 3);
  const difficulty = getReadingDifficultyLabel(technology.readingDifficulty);
  const tags = technology.tags
    .map((tagId) => getAllTags().find((tag) => tag.id === tagId))
    .filter((tag): tag is TopicTag => Boolean(tag));

  return (
    <DossierCard className="home-signal-card">
      <div className="home-signal-card__meta">
        <DossierStampTag>
          {getPriorityLevelLabel(ranking.priorityLevel, "zh")}
        </DossierStampTag>
        <span>{technology.publishDate}</span>
      </div>
      <h3>
        <Link href={`/technologies/${technology.slug}`}>
          {getPublicTechnologyTitle(technology)}
        </Link>
      </h3>
      <p>{summary}</p>
      <DossierCatalogNote label="为什么重要">{whyItMatters}</DossierCatalogNote>
      <div className="home-signal-card__footer">
        {audience.map((item) => (
          <span key={item}>{item}</span>
        ))}
        {difficulty ? <span>{difficulty}</span> : null}
      </div>
      <TagList tags={tags} limit={2} />
    </DossierCard>
  );
}

function SkillPathCard({ skill }: { skill: SkillItem }) {
  const relatedTechnologies = getAllTechnologies().filter((technology) =>
    skill.relatedTechnologyIds.includes(technology.id)
  );

  return (
    <DossierCard className="foundation-card">
      <DossierStampTag className="dossier-stamp-tag--muted">
        {skillTypeLabels[skill.skillType]}
      </DossierStampTag>
      <h3>
        <Link href={`/skills/${skill.slug}`}>{skill.title}</Link>
      </h3>
      <p>{skill.summary}</p>
      <small>已关联 {relatedTechnologies.length} 条已发布技术信号。</small>
    </DossierCard>
  );
}

function KnowledgePathCard({ item }: { item: KnowledgeItem }) {
  const relatedTechnologies = getAllTechnologies().filter((technology) =>
    item.relatedTechnologyIds.includes(technology.id)
  );

  return (
    <DossierCard className="foundation-card">
      <DossierStampTag className="dossier-stamp-tag--muted">
        {difficultyLabels[item.difficulty]}
      </DossierStampTag>
      <h3>
        <Link href={`/knowledge/${item.slug}`}>{item.title}</Link>
      </h3>
      <p>{item.summary}</p>
      <small>已解释 {relatedTechnologies.length} 条已发布技术信号。</small>
    </DossierCard>
  );
}

export default function HomePage() {
  const technologies = getAllTechnologies();
  const latestDigest = getLatestPublishedDailyDigest();
  const digestData = latestDigest
    ? getDailyDigestRenderData(latestDigest)
    : undefined;
  const highPriorityTechnologies = technologies
    .filter(
      (technology) =>
        evaluateTechnologyPriority(technology).priorityLevel === "high_priority"
    )
    .slice(0, 3);
  const prioritySignals =
    highPriorityTechnologies.length > 0
      ? highPriorityTechnologies
      : technologies.slice(0, 3);
  const skills = getAllSkills().slice(0, 3);
  const knowledge = getAllKnowledge().slice(0, 4);
  const latestNews = getLatestPublicNewsItems(4);

  return (
    <UserPageShell
      title="AI Tech Radar"
      description="发现、理解并持续跟踪值得优先关注的 AI 技术信号。"
      sectionLabel="AI 技术发现"
      showHeader={false}
      className="dossier"
    >
      <section className="product-home-hero">
        <div className="product-home-hero__copy">
          <p className="eyebrow user-eyebrow">AI 技术发现</p>
          <h1>
            <UnbreakableTitle text="发现值得关注的 AI 技术" />
          </h1>
          <p>一条清晰的阅读路径，帮你理解它为何重要、掌握所需背景。</p>
          <div className="product-home-hero__actions">
            <Link
              href="/digest/today"
              className="action-button action-button--primary"
            >
              阅读今日简报
            </Link>
            <Link href="/technologies" className="action-link">
              浏览技术信号
            </Link>
          </div>
          <p className="product-home-hero__stats">
            <span>
              <strong>{technologies.length}</strong> 条已发布技术信号
            </span>
            <span>
              <strong>{getAllSkills().length}</strong> 项理解与应用技能
            </span>
            <span>
              <strong>{getAllKnowledge().length}</strong> 个背景知识概念
            </span>
          </p>
        </div>
      </section>

      <section className="product-home-digest">
        <div className="section-heading">
          <div>
            <p className="eyebrow user-eyebrow">从这里开始</p>
            <h2>最新每日技术简报</h2>
          </div>
          <Link href="/digest/today" className="action-link">
            打开简报
          </Link>
        </div>
        {/* One column: the two counts used to sit in a fixed 150-220px right
            column of their own, which left most of that column empty — the
            same shape removed from the digest hero. */}
        {latestDigest && digestData ? (
          <DossierCard className="home-digest-card">
            <span>{latestDigest.date}</span>
            <h3>
              <Link href={`/digest/${latestDigest.date}`}>
                {getPublicDigestTitle(latestDigest)}
              </Link>
            </h3>
            <div className="home-digest-card__stats">
              <span>
                {digestData.highPriorityTechnologies.length} 条立即关注
              </span>
              <span>{digestData.watchTechnologies.length} 条值得跟踪</span>
            </div>
            <p>
              {compactText(
                getPublicDigestSummaryPlainText(latestDigest),
                digestCardSummaryLength
              )}
            </p>
          </DossierCard>
        ) : (
          <div className="empty-state empty-state--actionable">
            <strong>还没有已发布简报。</strong>
            <p>
              你可以先浏览已发布技术信号，等每日简报发布后这里会展示最新一期。
            </p>
            <Link href="/technologies" className="action-link">
              浏览技术信号
            </Link>
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow user-eyebrow">优先技术信号</p>
            <h2>现在最值得关注</h2>
          </div>
          <Link href="/technologies" className="action-link">
            查看全部信号
          </Link>
        </div>
        {prioritySignals.length > 0 ? (
          <div className="home-signal-grid">
            {prioritySignals.map((technology) => (
              <HomeTechnologyCard key={technology.id} technology={technology} />
            ))}
          </div>
        ) : (
          <div className="empty-state empty-state--actionable">
            <strong>还没有已发布技术信号。</strong>
            <p>发布正式技术记录后，这里会突出最值得先读的内容。</p>
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow user-eyebrow">今日快讯</p>
            <h2>来源里正在发生什么</h2>
          </div>
          <Link href="/technologies?view=news" className="action-link">
            查看全部快讯
          </Link>
        </div>
        {latestNews.length > 0 ? (
          <div className="home-news-list">
            {latestNews.map((item) => (
              <article key={item.key} className="home-news-row">
                <div className="home-news-row__meta">
                  <span className="home-news-row__source">
                    {item.sourceName}
                  </span>
                  <span>{item.publishDate}</span>
                </div>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {item.title}
                </a>
              </article>
            ))}
            <p className="home-news-list__note">{newsDisclaimer}</p>
          </div>
        ) : (
          <div className="empty-state">
            最近还没有自动聚合的快讯。来源定时导入后，这里会展示最新资讯。
          </div>
        )}
      </section>

      <section className="home-discovery-grid">
        <div className="home-discovery-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow user-eyebrow">技能</p>
              <h2>建立判断技术信号的能力</h2>
            </div>
            <Link href="/skills" className="action-link">
              查看技能
            </Link>
          </div>
          <div className="foundation-card-list">
            {skills.map((skill) => (
              <SkillPathCard key={skill.id} skill={skill} />
            ))}
          </div>
        </div>

        <div className="home-discovery-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow user-eyebrow">知识</p>
              <h2>用稳定概念理解新变化</h2>
            </div>
            <Link href="/knowledge" className="action-link">
              查看知识
            </Link>
          </div>
          <div className="foundation-card-list">
            {knowledge.map((item) => (
              <KnowledgePathCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </section>
    </UserPageShell>
  );
}
