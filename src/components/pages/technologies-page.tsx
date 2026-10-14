import Link from "next/link";

import { ChineseOnlyNote } from "@/components/chinese-only-note";
import { MyRadarContent } from "@/components/my-radar-content";
import { NewsFeedSection } from "@/components/news-feed-section";
import { SavedSignalsContent } from "@/components/saved-signals-content";
import { TechnologyBrowser } from "@/components/technology-browser";
import { TopicTimelineSection } from "@/components/topic-timeline-section";
import { UserPageShell } from "@/components/user-page-shell";
import { getAllTags, getAllTechnologies } from "@/lib/content";
import { signalsCopy } from "@/lib/i18n/copy/signals";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { localizeTags } from "@/lib/i18n/topic-names";
import type { Metadata } from "next";
import { buildPageMetadata, signalFeed } from "@/lib/site-metadata";
import {
  getPublisherSlug,
  getSignalPublisherName
} from "@/lib/source-directory";
import {
  parseTechnologyBrowserQuery,
  type TechnologyBrowserSearchParams
} from "@/lib/technology-browser-query";

export async function generateTechnologiesPageMetadata(
  locale: Locale,
  { searchParams }: TechnologiesPageProps
): Promise<Metadata> {
  const copy = signalsCopy[locale].page;
  const { view } = await searchParams;
  const current = parseView(view);
  const tab = viewTabs.find((item) => item.value === current);

  return buildPageMetadata({
    title:
      current === "curated"
        ? copy.title
        : copy.viewTitle(copy.tabs[tab?.value ?? "curated"], copy.title),
    description: copy.descriptions[current],
    path: tab?.href ?? "/technologies",
    // The two personal views render from localStorage; nothing to index.
    noIndex: current === "followed" || current === "saved",
    feeds: [signalFeed],
    locale
  });
}

type TechnologyView = "curated" | "news" | "timeline" | "followed" | "saved";

export interface TechnologiesPageProps {
  // `view` picks the tab; the curated view also reads its filters and sort
  // (q, type, tag, priority, publisher, sort) from here — see
  // technology-browser-query.
  searchParams: Promise<TechnologyBrowserSearchParams>;
}

function parseView(value: string | string[] | undefined): TechnologyView {
  const raw = Array.isArray(value) ? value[0] : value;

  if (
    raw === "news" ||
    raw === "timeline" ||
    raw === "followed" ||
    raw === "saved"
  ) {
    return raw;
  }

  return "curated";
}

// Chinese-site paths; the tab labels are in signalsCopy.
const viewTabs: { value: TechnologyView; href: string }[] = [
  { value: "curated", href: "/technologies" },
  { value: "news", href: "/technologies?view=news" },
  { value: "timeline", href: "/technologies?view=timeline" },
  { value: "followed", href: "/technologies?view=followed" },
  { value: "saved", href: "/technologies?view=saved" }
];

export async function TechnologiesPage({
  searchParams,
  locale
}: TechnologiesPageProps & { locale: Locale }) {
  const copy = signalsCopy[locale].page;
  const params = await searchParams;
  const view = parseView(params.view);
  const technologies = getAllTechnologies();
  const tags = localizeTags(getAllTags(), locale);

  return (
    <UserPageShell
      title={copy.title}
      description={copy.descriptions[view]}
      sectionLabel={view === "news" ? copy.sectionLabelNews : copy.sectionLabel}
      className="technology-list-page dossier"
      actions={
        <>
          <Link href={localePath(locale, "/sources")} className="action-link">
            {copy.sources}
          </Link>
          <Link href={localePath(locale, "/about")} className="action-link">
            {copy.about}
          </Link>
          {/* A plain anchor: the feed is a route handler, not a page, so
              client-side navigation and prefetch have nothing to load. */}
          <a href={signalFeed.path} className="action-link">
            {copy.rss}
          </a>
        </>
      }
    >
      {/* Links that load another view, not in-page tabs: a navigation with
          the current view marked, so a screen reader does not promise arrow
          keys and a panel that are not there. */}
      <nav className="technology-view-tabs" aria-label={copy.tabsLabel}>
        {viewTabs.map((tab) => (
          <Link
            key={tab.value}
            href={localePath(locale, tab.href)}
            aria-current={view === tab.value ? "page" : undefined}
            className={`technology-view-tab${
              view === tab.value ? " technology-view-tab--active" : ""
            }`}
          >
            {copy.tabs[tab.value]}
          </Link>
        ))}
      </nav>

      {view === "news" ? null : (
        <ChineseOnlyNote locale={locale}>{copy.chineseOnly}</ChineseOnlyNote>
      )}

      {view === "news" ? (
        <NewsFeedSection locale={locale} />
      ) : view === "timeline" ? (
        <TopicTimelineSection
          technologies={technologies}
          tags={tags}
          locale={locale}
        />
      ) : view === "followed" ? (
        <MyRadarContent technologies={technologies} tags={tags} />
      ) : view === "saved" ? (
        <SavedSignalsContent technologies={technologies} tags={tags} />
      ) : (
        <TechnologyBrowser
          technologies={technologies}
          tags={tags}
          initialQuery={parseTechnologyBrowserQuery(params, {
            types: technologies.map((item) => item.type),
            tagIds: tags.map((tag) => tag.id),
            publishers: technologies.map((item) =>
              getPublisherSlug(getSignalPublisherName(item))
            )
          })}
        />
      )}
    </UserPageShell>
  );
}
