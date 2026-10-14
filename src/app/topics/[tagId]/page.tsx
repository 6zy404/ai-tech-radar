import { notFound } from "next/navigation";
import Link from "next/link";
import { cache } from "react";

import { DossierCard } from "@/components/dossier-card";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { TopicFollowToggle } from "@/components/topic-follow-toggle";
import { TopicMiniGraph } from "@/components/topic-mini-graph";
import { UserPageShell } from "@/components/user-page-shell";
import { difficultyLabels, heatLabels } from "@/lib/content-labels";
import { topicFeedPath } from "@/lib/feed-paths";
import { getTopicHub } from "@/lib/topic-hub";
import { getRelationTypeLabel } from "@/lib/technology-localization";
import type { ContentKind } from "@/types/content";
import type { Metadata } from "next";
import { buildPageMetadata, siteName } from "@/lib/site-metadata";

interface TopicHubPageProps {
  params: Promise<{ tagId: string }>;
}

export const dynamic = "force-dynamic";

// generateMetadata and the page each need the hub; `cache` builds it once per
// request instead of twice.
const getRequestTopicHub = cache(getTopicHub);

export async function generateMetadata({
  params
}: TopicHubPageProps): Promise<Metadata> {
  const { tagId } = await params;
  const hub = getRequestTopicHub(tagId);

  if (!hub) {
    return buildPageMetadata({
      title: "没有这一页",
      path: `/topics/${tagId}`,
      noIndex: true
    });
  }

  return buildPageMetadata({
    title: `${hub.tag.name} · 专题`,
    description: hub.tag.description,
    path: `/topics/${hub.tag.id}`,
    // The feed route 404s for a topic with no published signal, which is
    // also when the RSS column of 跟进此话题 below is left out.
    feeds:
      hub.technologies.length > 0
        ? [
            {
              path: topicFeedPath(hub.tag.id),
              title: `${siteName} · 话题：${hub.tag.name}`
            }
          ]
        : [],
    largeImage: true
  });
}

const kindLabels: Record<ContentKind, string> = {
  technology: "技术",
  skill: "技能",
  knowledge: "知识"
};

export default async function TopicHubPage({ params }: TopicHubPageProps) {
  const { tagId } = await params;
  const hub = getRequestTopicHub(tagId);

  if (!hub) {
    notFound();
  }

  const { tag, technologies, skills, knowledge, relatedNodes, graph } = hub;

  return (
    <UserPageShell
      title={tag.name}
      description={tag.description}
      sectionLabel="主题聚合"
      className="topic-hub-page dossier"
      actions={
        <Link href="/topics" className="action-link">
          全部话题
        </Link>
      }
    >
      {/* 关注 (the on-site radar, this browser only) and 订阅 (an RSS feed
          read elsewhere) are different things, so each column is labelled by
          where it takes effect. The feed column is left out when the feed
          would 404. */}
      <section className="topic-hub-section topic-hub-follow">
        <div className="topic-hub-section__heading">
          <h2>跟进此话题</h2>
          <span>
            {technologies.length > 0 ? "站内关注 · 站外订阅" : "站内关注"}
          </span>
        </div>
        <div className="topic-hub-follow__options">
          <div className="topic-hub-follow__option">
            <div className="topic-hub-follow__label">站内 · 我的雷达</div>
            <TopicFollowToggle tagId={tag.id} tagName={tag.name} />
          </div>
          {technologies.length > 0 ? (
            <div className="topic-hub-follow__option">
              <div className="topic-hub-follow__label">站外 · RSS 阅读器</div>
              <div className="digest-feed-links">
                <Link href={topicFeedPath(tag.id)}>RSS 订阅源</Link>
                <span className="topic-hub-subscribe-hint">
                  {`把这个订阅源加进任何 RSS 阅读器，「${tag.name}」下新发布的技术信号会自动送达，无需账号。`}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <TopicMiniGraph graph={graph} topicName={tag.name} />

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
