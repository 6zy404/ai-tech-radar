import Link from "next/link";

import { ChineseOnlyNote } from "@/components/chinese-only-note";
import { DossierCard } from "@/components/dossier-card";
import { DossierCategoryChips } from "@/components/dossier-category-chips";
import { LangSpan } from "@/components/lang-scope";
import { RelationDensity } from "@/components/relation-density";
import { UserPageShell } from "@/components/user-page-shell";
import { getAllTechnologies } from "@/lib/content";
import { sourcesCopy } from "@/lib/i18n/copy/sources";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { nameLangAttr } from "@/lib/i18n/text-lang";
import { buildPageMetadata, signalFeed } from "@/lib/site-metadata";
import {
  buildSourceDirectory,
  getPublisherSignalsHref,
  getSourceDirectoryAnchor,
  groupSourceDirectoryByPublisherType
} from "@/lib/source-directory";

export function getSourcesPageMetadata(locale: Locale) {
  const copy = sourcesCopy[locale];

  return buildPageMetadata({
    title: copy.title,
    description: copy.description,
    path: "/sources",
    // Everything on this page is derived from the published signals, so the
    // all-signals feed is the one to subscribe to from here.
    feeds: [signalFeed],
    locale
  });
}

function sectionId(publisherType: string): string {
  return `sources-section-${publisherType}`;
}

// The /skills, /knowledge and /topics list skeleton — header label, one-line
// lede, a caption row of counts, sections of two-column cards — through their
// classes rather than a copy. Built only from published signals' public
// fields; see src/lib/source-directory.ts for what it must never read.
export function SourcesPage({ locale }: { locale: Locale }) {
  const copy = sourcesCopy[locale];
  const { entries, totals } = buildSourceDirectory(
    getAllTechnologies(),
    locale
  );
  const sections = groupSourceDirectoryByPublisherType(entries);

  return (
    <UserPageShell
      title={copy.title}
      description={copy.description}
      sectionLabel={copy.sectionLabel}
      className="skills-library-page sources-page dossier"
    >
      {entries.length === 0 ? (
        <section className="skills-library-empty">
          <p className="eyebrow user-eyebrow">{copy.emptyEyebrow}</p>
          <h2>{copy.emptyTitle}</h2>
          <p>{copy.emptyBody}</p>
        </section>
      ) : (
        <>
          <section className="skills-library-intro">
            <div className="skills-library-intro__copy">
              <p>{copy.intro}</p>
            </div>
            <dl className="skills-library-stats" aria-label={copy.statsLabel}>
              <div>
                <dt>{totals.publishers}</dt>
                <dd>{copy.statPublishers}</dd>
              </div>
              <div>
                <dt>{totals.signals}</dt>
                <dd>{copy.statSignals}</dd>
              </div>
              <div>
                <dt>{totals.sources}</dt>
                <dd>{copy.statSources}</dd>
              </div>
            </dl>
            {/* Jump links, not a filter: the cards run to several screens,
                and these land on a section without hiding the rest. */}
            <DossierCategoryChips
              className="sources-jump"
              ariaLabel={copy.jumpLabel}
              active=""
              options={sections.map((section) => ({
                value: section.publisherType,
                label: `${section.label} · ${section.entries.length}`,
                href: `#${sectionId(section.publisherType)}`
              }))}
            />
          </section>

          <ChineseOnlyNote locale={locale}>{copy.chineseOnly}</ChineseOnlyNote>

          <div className="skills-library-groups">
            {sections.map((section) => (
              <section
                className="skills-library-section"
                key={section.publisherType}
                aria-labelledby={sectionId(section.publisherType)}
              >
                <div className="skills-library-section__header">
                  <div>
                    <p className="eyebrow user-eyebrow">
                      {copy.sectionEyebrow}
                    </p>
                    <h2 id={sectionId(section.publisherType)}>
                      {section.label}
                    </h2>
                  </div>
                  <p>
                    {copy.sectionCounts(
                      section.entries.length,
                      section.signalCount
                    )}
                  </p>
                </div>
                <div className="skills-library-card-grid">
                  {section.entries.map((entry) => (
                    <DossierCard
                      className="skill-library-card sources-card"
                      key={entry.publisherName}
                    >
                      <h3
                        id={getSourceDirectoryAnchor(entry.publisherName)}
                        lang={nameLangAttr(locale, entry.publisherName)}
                      >
                        {entry.publisherName}
                      </h3>
                      <RelationDensity
                        label={copy.densityLabel}
                        items={[
                          { n: entry.signalCount, label: copy.densitySignals },
                          {
                            n: entry.sourceNames.length,
                            label: copy.densitySources
                          }
                        ]}
                      />
                      <div className="skill-library-card__signals sources-card__recent">
                        <span>
                          {entry.recent.length === 1
                            ? copy.recentOne
                            : copy.recentMany(entry.recent.length)}
                        </span>
                        <ol>
                          {entry.recent.map((item) => (
                            <li key={item.slug}>
                              <time dateTime={item.publishDate}>
                                {item.publishDate}
                              </time>
                              <Link
                                href={localePath(
                                  locale,
                                  `/technologies/${item.slug}`
                                )}
                                lang={item.titleLang}
                              >
                                {item.title}
                              </Link>
                            </li>
                          ))}
                        </ol>
                      </div>
                      <p className="sources-card__via">
                        <span>{copy.via}</span>{" "}
                        <LangSpan
                          lang={nameLangAttr(
                            locale,
                            entry.sourceNames.join(" · ")
                          )}
                        >
                          {entry.sourceNames.join(" · ")}
                        </LangSpan>
                      </p>
                      {/* Only where the card lists fewer than it counts:
                          on the rest the list above is already every
                          signal, and the link would lead to the same few. */}
                      {entry.signalCount > entry.recent.length ? (
                        <Link
                          href={getPublisherSignalsHref(
                            entry.publisherName,
                            locale
                          )}
                          className="skill-library-card__link"
                        >
                          {copy.seeAll(entry.signalCount)}
                        </Link>
                      ) : null}
                    </DossierCard>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </UserPageShell>
  );
}
