import Link from "next/link";

import { TagList } from "@/components/tag-list";
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
import { getLatestPublishedDailyDigest } from "@/lib/digest-workflow";
import { getDailyDigestRenderData } from "@/lib/digest-view";
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
  getLocalizedTechnologyText
} from "@/lib/technology-localization";
import type {
  KnowledgeItem,
  SkillItem,
  TechnologyItem,
  TopicTag
} from "@/types/content";

export const dynamic = "force-dynamic";

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
    getTechnologyWhyItMatters(technology, getPriorityUserSummary(ranking, "zh")) ??
    summary;
  const audience = getTechnologyAudience(technology).slice(0, 3);
  const difficulty = getReadingDifficultyLabel(technology.readingDifficulty);
  const tags = technology.tags
    .map((tagId) => getAllTags().find((tag) => tag.id === tagId))
    .filter((tag): tag is TopicTag => Boolean(tag));

  return (
    <article className="home-signal-card">
      <div className="home-signal-card__meta">
        <span className={getPriorityLevelClass(ranking.priorityLevel)}>
          {getPriorityLevelLabel(ranking.priorityLevel, "zh")}
        </span>
        <span>{technology.publishDate}</span>
      </div>
      <h3>
        <Link href={`/technologies/${technology.slug}`}>
          {getPublicTechnologyTitle(technology)}
        </Link>
      </h3>
      <p>{summary}</p>
      <div className="home-signal-card__why">
        <span>为什么值得看</span>
        <p>{whyItMatters}</p>
      </div>
      <div className="home-signal-card__footer">
        {audience.map((item) => (
          <span key={item}>{item}</span>
        ))}
        {difficulty ? <span>{difficulty}</span> : null}
      </div>
      <TagList tags={tags} limit={2} />
    </article>
  );
}

function SkillPathCard({ skill }: { skill: SkillItem }) {
  const relatedTechnologies = getAllTechnologies().filter((technology) =>
    skill.relatedTechnologyIds.includes(technology.id)
  );

  return (
    <article className="foundation-card">
      <span className="foundation-card__label">{skill.skillType}</span>
      <h3>
        <Link href={`/skills/${skill.slug}`}>{skill.title}</Link>
      </h3>
      <p>{skill.summary}</p>
      <small>关联 {relatedTechnologies.length} 条已发布技术信号。</small>
    </article>
  );
}

function KnowledgePathCard({ item }: { item: KnowledgeItem }) {
  const relatedTechnologies = getAllTechnologies().filter((technology) =>
    item.relatedTechnologyIds.includes(technology.id)
  );

  return (
    <article className="foundation-card">
      <span className="foundation-card__label">{item.difficulty}</span>
      <h3>
        <Link href={`/knowledge/${item.slug}`}>{item.title}</Link>
      </h3>
      <p>{item.summary}</p>
      <small>解释 {relatedTechnologies.length} 条已发布技术信号。</small>
    </article>
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

  return (
    <UserPageShell
      title="AI Tech Radar"
      description="发现、理解并持续跟踪值得优先关注的 AI 技术信号。"
      sectionLabel="AI 技术发现"
      showHeader={false}
    >
      <section className="product-home-hero">
        <div className="product-home-hero__copy">
          <p className="eyebrow user-eyebrow">AI 技术发现</p>
          <h1>发现值得关注的 AI 技术，理解它为何重要，掌握所需背景。</h1>
          <p>
            AI Tech Radar 把已发布的技术信号整理成清晰的阅读路径：今日简报、
            高优先级信号、相关技能，以及帮助理解变化的背景知识。
          </p>
          <div className="product-home-hero__actions">
            <Link href="/digest/today" className="action-button action-button--primary">
              阅读今日简报
            </Link>
            <Link href="/technologies" className="action-link">
              浏览技术信号
            </Link>
          </div>
        </div>
        <div className="product-home-hero__stats">
          <strong>{technologies.length}</strong>
          <span>已发布技术信号</span>
          <strong>{getAllSkills().length}</strong>
          <span>理解与应用技能</span>
          <strong>{getAllKnowledge().length}</strong>
          <span>背景知识概念</span>
        </div>
      </section>

      <section className="home-entry-grid" aria-label="Primary public entry points">
        <Link href="/digest/today" className="home-entry-card home-entry-card--highlight">
          <span>今日简报</span>
          <strong>直接看今天最值得关注的内容</strong>
          <small>按优先级整理今日技术信号</small>
        </Link>
        <Link href="/technologies" className="home-entry-card">
          <span>浏览技术信号</span>
          <strong>快速判断这是什么</strong>
          <small>查看来源、标签、关注人群与学习路径</small>
        </Link>
        <Link href="/skills" className="home-entry-card">
          <span>探索技能与知识</span>
          <strong>补齐理解新技术的背景</strong>
          <small>从能力和概念进入技术解读</small>
        </Link>
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
        {latestDigest && digestData ? (
          <article className="home-digest-card">
            <div>
              <span>{latestDigest.date}</span>
              <h3>
                <Link href={`/digest/${latestDigest.date}`}>
                  {getPublicDigestTitle(latestDigest)}
                </Link>
              </h3>
              <p>{getPublicDigestSummary(latestDigest)}</p>
            </div>
            <div className="home-digest-card__stats">
              <strong>{digestData.highPriorityTechnologies.length}</strong>
              <span>立即关注</span>
              <strong>{digestData.watchTechnologies.length}</strong>
              <span>值得跟踪</span>
            </div>
          </article>
        ) : (
          <div className="empty-state empty-state--actionable">
            <strong>还没有已发布简报。</strong>
            <p>你可以先浏览已发布技术信号，等每日简报发布后这里会展示最新一期。</p>
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
          <p>这些已发布条目结合来源、优先级和解释字段，帮助读者快速判断下一步该看什么。</p>
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
