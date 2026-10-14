import { notFound } from "next/navigation";
import Link from "next/link";
import { cache } from "react";

import { ChineseOnlyNote } from "@/components/chinese-only-note";
import { DossierCard } from "@/components/dossier-card";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { LangSpan } from "@/components/lang-scope";
import { TopicFollowToggle } from "@/components/topic-follow-toggle";
import { TopicMiniGraph } from "@/components/topic-mini-graph";
import { UserPageShell } from "@/components/user-page-shell";
import { contentLabelsByLocale } from "@/lib/content-labels";
import { topicFeedPath } from "@/lib/feed-paths";
import { topicsCopy } from "@/lib/i18n/copy/topics";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { contentLangAttr, nameLangAttr } from "@/lib/i18n/text-lang";
import { getTopicHub } from "@/lib/topic-hub";
import { getRelationTypeLabel } from "@/lib/technology-localization";
import type { Metadata } from "next";
import { buildPageMetadata, siteName } from "@/lib/site-metadata";

// generateMetadata and the page each need the hub; `cache` builds it once per
// request instead of twice.
const getRequestTopicHub = cache(getTopicHub);

export interface TopicHubPageProps {
  params: Promise<{ tagId: string }>;
}

export async function generateTopicHubPageMetadata(
  locale: Locale,
  { params }: TopicHubPageProps
): Promise<Metadata> {
  const copy = topicsCopy[locale].hub;
  const { tagId } = await params;
  const hub = getRequestTopicHub(tagId, locale);

  if (!hub) {
    return buildPageMetadata({
      title: copy.notFoundTitle,
      path: `/topics/${tagId}`,
      noIndex: true,
      locale
    });
  }

  return buildPageMetadata({
    title: copy.pageTitle(hub.tag.name),
    description: hub.tag.description,
    path: `/topics/${hub.tag.id}`,
    // The feed route 404s for a topic with no published signal, which is
    // also when the RSS column of 跟进此话题 below is left out.
    feeds:
      hub.technologies.length > 0
        ? [
            {
              path: topicFeedPath(hub.tag.id),
              title: copy.feedTitle(siteName, hub.tag.name)
            }
          ]
        : [],
    largeImage: true,
    locale
  });
}

export async function TopicHubPage({
  params,
  locale
}: TopicHubPageProps & { locale: Locale }) {
  const copy = topicsCopy[locale].hub;
  const labels = contentLabelsByLocale[locale];
  // Skill and knowledge entries are Chinese only.
  const entryLang = contentLangAttr(locale);
  const { tagId } = await params;
  const hub = getRequestTopicHub(tagId, locale);

  if (!hub) {
    notFound();
  }

  const { tag, technologies, skills, knowledge, relatedNodes, graph } = hub;
  const nodeLangs = hub.nodeLangs ?? {};

  return (
    <UserPageShell
      title={tag.name}
      description={tag.description}
      sectionLabel={copy.sectionLabel}
      className="topic-hub-page dossier"
      actions={
        <Link href={localePath(locale, "/topics")} className="action-link">
          {copy.allTopics}
        </Link>
      }
    >
      {/* 关注 (the on-site radar, this browser only) and 订阅 (an RSS feed
          read elsewhere) are different things, so each column is labelled by
          where it takes effect. The feed column is left out when the feed
          would 404. */}
      <section className="topic-hub-section topic-hub-follow">
        <div className="topic-hub-section__heading">
          <h2>{copy.followHeading}</h2>
          <span>
            {technologies.length > 0
              ? copy.followModesBoth
              : copy.followModesSite}
          </span>
        </div>
        <div className="topic-hub-follow__options">
          <div className="topic-hub-follow__option">
            <div className="topic-hub-follow__label">{copy.followOnSite}</div>
            <TopicFollowToggle tagId={tag.id} tagName={tag.name} />
          </div>
          {technologies.length > 0 ? (
            <div className="topic-hub-follow__option">
              <div className="topic-hub-follow__label">
                {copy.followOffSite}
              </div>
              <div className="digest-feed-links">
                <Link href={topicFeedPath(tag.id)}>{copy.feedLink}</Link>
                <span className="topic-hub-subscribe-hint">
                  {copy.feedHint(tag.name)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <TopicMiniGraph
        graph={graph}
        topicName={tag.name}
        nodeLangs={nodeLangs}
        locale={locale}
      />

      <ChineseOnlyNote locale={locale}>{copy.chineseOnly}</ChineseOnlyNote>

      {technologies.length > 0 ? (
        <section className="topic-hub-section">
          <div className="topic-hub-section__heading">
            <h2>{copy.signalsHeading}</h2>
            <span>{copy.signalsCount(technologies.length)}</span>
          </div>
          <div className="topic-hub-section__list">
            {technologies.map((item) => (
              <DossierCard key={item.slug} className="topic-hub-card">
                <div className="topic-hub-card__meta">
                  <span lang={nameLangAttr(locale, item.sourceName)}>
                    {item.sourceName}
                  </span>
                  <span>{item.publishDate}</span>
                </div>
                <h3 lang={item.titleLang}>
                  <Link href={localePath(locale, `/technologies/${item.slug}`)}>
                    {item.title}
                  </Link>
                </h3>
                <p lang={item.summaryLang}>{item.summary}</p>
              </DossierCard>
            ))}
          </div>
        </section>
      ) : null}

      {skills.length > 0 ? (
        <section className="topic-hub-section">
          <div className="topic-hub-section__heading">
            <h2>{copy.skillsHeading}</h2>
            <span>{copy.skillsCount(skills.length)}</span>
          </div>
          <div className="topic-hub-section__list">
            {skills.map((item) => (
              <DossierCard key={item.id} className="topic-hub-card">
                <DossierStampTag className="dossier-stamp-tag--muted">
                  {labels.heat[item.heatLevel]}
                </DossierStampTag>
                <h3 lang={entryLang}>
                  <Link href={localePath(locale, `/skills/${item.slug}`)}>
                    {item.title}
                  </Link>
                </h3>
                <p lang={entryLang}>{item.summary}</p>
              </DossierCard>
            ))}
          </div>
        </section>
      ) : null}

      {knowledge.length > 0 ? (
        <section className="topic-hub-section">
          <div className="topic-hub-section__heading">
            <h2>{copy.knowledgeHeading}</h2>
            <span>{copy.knowledgeCount(knowledge.length)}</span>
          </div>
          <div className="topic-hub-section__list">
            {knowledge.map((item) => (
              <DossierCard key={item.id} className="topic-hub-card">
                <DossierStampTag className="dossier-stamp-tag--muted">
                  {labels.difficulty[item.difficulty]}
                </DossierStampTag>
                <h3 lang={entryLang}>
                  <Link href={localePath(locale, `/knowledge/${item.slug}`)}>
                    {item.title}
                  </Link>
                </h3>
                <p lang={entryLang}>{item.summary}</p>
              </DossierCard>
            ))}
          </div>
        </section>
      ) : null}

      {relatedNodes.length > 0 ? (
        <section className="topic-hub-section">
          <div className="topic-hub-section__heading">
            <h2>{copy.relatedHeading}</h2>
            <span>{copy.relatedNote}</span>
          </div>
          <div className="topic-hub-section__relations">
            {relatedNodes.map((node) => (
              <Link
                key={node.id}
                href={node.href}
                className="topic-hub-relation"
              >
                <DossierStampTag>
                  {copy.kinds[node.kind]} ·{" "}
                  {getRelationTypeLabel(node.relationType, "zh", locale)}
                </DossierStampTag>
                <LangSpan lang={nodeLangs[node.id]}>{node.title}</LangSpan>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </UserPageShell>
  );
}
