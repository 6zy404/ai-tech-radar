import { notFound } from "next/navigation";

import { JsonLd } from "@/components/json-ld";
import { TechnologyDetailContent } from "@/components/technology-detail-content";
import { UserPageShell } from "@/components/user-page-shell";
import { compactText } from "@/lib/compact-text";
import {
  buildRelationItems,
  getAllKnowledge,
  getAllTechnologies,
  getTagsByIds,
  getTechnologyBySlug
} from "@/lib/content";
import { technologyDetailCopy } from "@/lib/i18n/copy/technology-detail";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { contentLangAttr } from "@/lib/i18n/text-lang";
import { localizeTags } from "@/lib/i18n/topic-names";
import {
  buildKnowledgeLinkTargets,
  selectKnowledgeLinkTargets
} from "@/lib/knowledge-autolink";
import { getSignalIssueAppearances } from "@/lib/signal-digest-appearances";
import { getSignalNeighbors } from "@/lib/signal-neighbors";
import { getSimilarSignals } from "@/lib/similar-signals";
import { buildTechnologyJsonLd } from "@/lib/structured-data";
import { getTechnologyEvolutionChain } from "@/lib/technology-evolution";
import { getAllLinkRelations } from "@/lib/link-relation-workflow";
import {
  getTechnologySummaryForLocale,
  getTechnologyTitleForLocale
} from "@/lib/technology-localization";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";
import type { RelationListItem, TechnologyItem } from "@/types/content";

export interface TechnologyDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateTechnologyDetailPageMetadata(
  locale: Locale,
  { params }: TechnologyDetailPageProps
): Promise<Metadata> {
  const { slug } = await params;
  const technology = getTechnologyBySlug(slug);

  if (!technology) {
    return buildPageMetadata({
      title: technologyDetailCopy[locale].page.notFoundTitle,
      path: `/technologies/${slug}`,
      noIndex: true,
      locale
    });
  }

  return buildPageMetadata({
    title: getTechnologyTitleForLocale(technology, locale).text,
    description: getTechnologySummaryForLocale(technology, locale).text,
    path: `/technologies/${technology.slug}`,
    type: "article",
    publishedTime: technology.publishDate,
    largeImage: true,
    locale
  });
}

// The similar-signal card's one-line gist, as similar-signals.ts cuts it.
const similarSummaryLength = 80;

export async function TechnologyDetailPage({
  params,
  locale
}: TechnologyDetailPageProps & { locale: Locale }) {
  const copy = technologyDetailCopy[locale].page;
  const { slug } = await params;
  const technology = getTechnologyBySlug(slug);

  if (!technology) {
    notFound();
  }

  const technologies = getAllTechnologies();
  const technologyById = new Map(technologies.map((item) => [item.id, item]));
  const technologyBySlug = new Map(
    technologies.map((item) => [item.slug, item])
  );
  // `lang` per slug for the signal titles below that stay Chinese on the
  // English site; empty on the Chinese site.
  const titleLangs: Record<string, string> = {};
  const titleFor = (item: TechnologyItem) => {
    const title = getTechnologyTitleForLocale(item, locale);
    const lang = contentLangAttr(locale, title.language);

    if (lang) {
      titleLangs[item.slug] = lang;
    }

    return { text: title.text, lang };
  };
  // On the English site a related item links under /en, a signal is named in
  // English where it can be, and a skill or knowledge title is marked as
  // Chinese. On the Chinese site the items pass through unchanged.
  const localizeItems = (items: RelationListItem[]): RelationListItem[] =>
    locale === "zh"
      ? items
      : items.map((item) => {
          const related = technologyById.get(item.id);
          const title = related
            ? titleFor(related)
            : { text: item.title, lang: contentLangAttr(locale) };

          return {
            ...item,
            title: title.text,
            href: localePath(locale, item.href),
            titleLang: title.lang
          };
        });

  // One read of the merged relations shared by the three lists below.
  const relations = getAllLinkRelations();
  const relatedSkills = localizeItems(
    buildRelationItems({
      fromId: technology.id,
      fromType: "technology",
      targetType: "skill",
      targetIds: technology.relatedSkillIds,
      defaultNote: copy.defaultSkillNote,
      relations
    })
  );
  const relatedKnowledge = localizeItems(
    buildRelationItems({
      fromId: technology.id,
      fromType: "technology",
      targetType: "knowledge",
      targetIds: technology.relatedKnowledgeIds,
      defaultNote: copy.defaultKnowledgeNote,
      relations
    })
  );
  const relatedTechnologies = localizeItems(
    buildRelationItems({
      fromId: technology.id,
      fromType: "technology",
      targetType: "technology",
      targetIds: technology.relatedTechnologyIds ?? [],
      defaultNote: copy.defaultTechnologyNote,
      relations
    })
  );
  const sourceChain = getTechnologyEvolutionChain(technology.id);
  const evolutionChain =
    sourceChain && locale !== "zh"
      ? {
          ...sourceChain,
          steps: sourceChain.steps.map((step) => {
            const item = technologyById.get(step.id);

            return item ? { ...step, title: titleFor(item).text } : step;
          })
        }
      : sourceChain;
  // What the page already links to is not repeated as "similar".
  const sourceSimilar = await getSimilarSignals(technology.id, [
    ...(technology.relatedTechnologyIds ?? []),
    ...(sourceChain?.steps.map((step) => step.id) ?? [])
  ]);
  const similarSignals =
    locale === "zh"
      ? sourceSimilar
      : sourceSimilar.map((link) => {
          const item = technologyById.get(link.id);

          if (!item) {
            return { ...link, href: localePath(locale, link.href) };
          }

          const title = titleFor(item);
          const summary = getTechnologySummaryForLocale(item, locale);

          return {
            ...link,
            title: title.text,
            href: localePath(locale, link.href),
            summary: compactText(summary.text, similarSummaryLength),
            titleLang: title.lang,
            summaryLang: contentLangAttr(locale, summary.language)
          };
        });
  const compareCandidates = technologies
    .filter((item) => item.id !== technology.id)
    .map((item) => ({
      id: item.id,
      title: getTechnologyTitleForLocale(item, locale).text,
      href: localePath(locale, `/technologies/${item.slug}`)
    }));
  const tags = localizeTags(getTagsByIds(technology.tags), locale);
  // Only the knowledge this body mentions, in either language, goes to the
  // client; the matching itself runs there so the 中文 / 原文 switch re-links.
  const knowledgeLinks = selectKnowledgeLinkTargets(
    buildKnowledgeLinkTargets(getAllKnowledge()),
    [
      technology.content.original,
      technology.content.zh ?? "",
      technology.content.en ?? ""
    ]
  ).map((target) =>
    locale === "zh"
      ? target
      : { ...target, href: localePath(locale, target.href) }
  );
  const neighbors = getSignalNeighbors(technology.id, locale);

  for (const neighbor of [neighbors.older, neighbors.newer]) {
    const item = neighbor ? technologyBySlug.get(neighbor.slug) : undefined;

    if (item) {
      titleFor(item);
    }
  }

  // Built here, not in TechnologyDetailContent: the workspace preview renders
  // drafts through that component and must not emit structured data.
  const structuredData = buildTechnologyJsonLd(
    technology,
    tags,
    undefined,
    locale
  );

  return (
    <>
      <UserPageShell
        title={copy.shellTitle}
        description={copy.shellDescription}
        sectionLabel={copy.shellSectionLabel}
        showHeader={false}
        className="dossier"
      >
        <TechnologyDetailContent
          technology={technology}
          tags={tags}
          relatedTechnologies={relatedTechnologies}
          relatedSkills={relatedSkills}
          relatedKnowledge={relatedKnowledge}
          compareCandidates={compareCandidates}
          evolutionChain={evolutionChain}
          similarSignals={similarSignals}
          issueAppearances={getSignalIssueAppearances(technology)}
          neighbors={neighbors}
          knowledgeLinks={knowledgeLinks}
          titleLangs={titleLangs}
        />
      </UserPageShell>
      {structuredData ? <JsonLd data={structuredData} /> : null}
    </>
  );
}
