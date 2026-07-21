import { notFound } from "next/navigation";
import Link from "next/link";

import { DossierCard } from "@/components/dossier-card";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { UserPageShell } from "@/components/user-page-shell";
import { topicFeedPath } from "@/lib/feed-paths";
import { getTopicHub } from "@/lib/topic-hub";
import { getRelationTypeLabel } from "@/lib/technology-localization";
import type { ContentKind, HeatLevel, DifficultyLevel } from "@/types/content";

interface TopicHubPageProps {
  params: Promise<{ tagId: string }>;
}

export const dynamic = "force-dynamic";

const heatLabels: Record<HeatLevel, string> = {
  hot: "当前热门",
  active: "活跃",
  emerging: "新兴"
};

const difficultyLabels: Record<DifficultyLevel, string> = {
  foundation: "基础",
  intermediate: "进阶",
  advanced: "高级"
};

const kindLabels: Record<ContentKind, string> = {
  technology: "技术",
  skill: "技能",
  knowledge: "知识"
};

export default async function TopicHubPage({ params }: TopicHubPageProps) {
  const { tagId } = await params;
  const hub = getTopicHub(tagId);

  if (!hub) {
    notFound();
  }

  const { tag, technologies, skills, knowledge, relatedNodes } = hub;

  return (
    <UserPageShell
      title={tag.name}
      description={tag.description}
      sectionLabel="主题聚合"
      className="topic-hub-page dossier"
    >
      {technologies.length > 0 ? (
        <section className="topic-hub-section">
          <div className="topic-hub-section__heading">
            <h2>订阅此话题</h2>
            <span>更新自动送达</span>
          </div>
          <div className="digest-feed-links">
            <Link href={topicFeedPath(tag.id)}>RSS 订阅源</Link>
            <span className="topic-hub-subscribe-hint">
              {`把这个订阅源加进任何 RSS 阅读器，「${tag.name}」下新发布的技术信号会自动送达，无需账号。`}
            </span>
          </div>
        </section>
      ) : null}

      {technologies.length > 0 ? (
        <section className="topic-hub-section">
          <div className="topic-hub-section__heading">
            <h2>已发布技术信号</h2>
            <span>{technologies.length} 条</span>
          </div>
          <div className="topic-hub-section__list">
            {technologies.map((item) => (
              <DossierCard key={item.slug} className="topic-hub-card">
                <div className="topic-hub-card__meta">
                  <span>{item.sourceName}</span>
                  <span>{item.publishDate}</span>
                </div>
                <h3>
                  <Link href={`/technologies/${item.slug}`}>{item.title}</Link>
                </h3>
                <p>{item.summary}</p>
              </DossierCard>
            ))}
          </div>
        </section>
      ) : null}

      {skills.length > 0 ? (
        <section className="topic-hub-section">
          <div className="topic-hub-section__heading">
            <h2>相关技能</h2>
            <span>{skills.length} 项</span>
          </div>
          <div className="topic-hub-section__list">
            {skills.map((item) => (
              <DossierCard key={item.id} className="topic-hub-card">
                <DossierStampTag className="dossier-stamp-tag--muted">
                  {heatLabels[item.heatLevel]}
                </DossierStampTag>
                <h3>
                  <Link href={`/skills/${item.slug}`}>{item.title}</Link>
                </h3>
                <p>{item.summary}</p>
              </DossierCard>
            ))}
          </div>
        </section>
      ) : null}

      {knowledge.length > 0 ? (
        <section className="topic-hub-section">
          <div className="topic-hub-section__heading">
            <h2>背景知识</h2>
            <span>{knowledge.length} 条</span>
          </div>
          <div className="topic-hub-section__list">
            {knowledge.map((item) => (
              <DossierCard key={item.id} className="topic-hub-card">
                <DossierStampTag className="dossier-stamp-tag--muted">
                  {difficultyLabels[item.difficulty]}
                </DossierStampTag>
                <h3>
                  <Link href={`/knowledge/${item.slug}`}>{item.title}</Link>
                </h3>
                <p>{item.summary}</p>
              </DossierCard>
            ))}
          </div>
        </section>
      ) : null}

      {relatedNodes.length > 0 ? (
        <section className="topic-hub-section">
          <div className="topic-hub-section__heading">
            <h2>图谱关联</h2>
            <span>来自 /network 的直接邻居</span>
          </div>
          <div className="topic-hub-section__relations">
            {relatedNodes.map((node) => (
              <Link
                key={node.id}
                href={node.href}
                className="topic-hub-relation"
              >
                <DossierStampTag>
                  {kindLabels[node.kind]} ·{" "}
                  {getRelationTypeLabel(node.relationType, "zh")}
                </DossierStampTag>
                {node.title}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </UserPageShell>
  );
}
