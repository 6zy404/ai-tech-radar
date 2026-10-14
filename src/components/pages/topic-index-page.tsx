import Link from "next/link";

import { DossierCard } from "@/components/dossier-card";
import { RelationDensity } from "@/components/relation-density";
import { UserPageShell } from "@/components/user-page-shell";
import { topicsCopy } from "@/lib/i18n/copy/topics";
import type { Locale } from "@/lib/i18n/locale";
import { buildPageMetadata } from "@/lib/site-metadata";
import { getTopicHubPath, getTopicIndex } from "@/lib/topic-hub";

export function getTopicIndexPageMetadata(locale: Locale) {
  const copy = topicsCopy[locale].index;

  return buildPageMetadata({
    title: copy.title,
    description: copy.description,
    path: "/topics",
    locale
  });
}

// The index shares the /skills and /knowledge list skeleton — header label,
// one-line lede, a caption row of counts, a two-column card grid — through
// their classes rather than a copy, so the three index pages stay one family.
export function TopicIndexPage({ locale }: { locale: Locale }) {
  const copy = topicsCopy[locale].index;
  const { topics, coverage } = getTopicIndex(locale);

  return (
    <UserPageShell
      title={copy.title}
      description={copy.description}
      sectionLabel={copy.sectionLabel}
      className="skills-library-page topic-index-page dossier"
    >
      {topics.length === 0 ? (
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
                <dt>{topics.length}</dt>
                <dd>{copy.statTopics}</dd>
              </div>
              <div>
                <dt>{coverage.technologies}</dt>
                <dd>{copy.statSignals}</dd>
              </div>
              <div>
                <dt>{coverage.skills}</dt>
                <dd>{copy.statSkills}</dd>
              </div>
              <div>
                <dt>{coverage.knowledge}</dt>
                <dd>{copy.statKnowledge}</dd>
              </div>
            </dl>
          </section>

          <div className="skills-library-groups">
            <div className="skills-library-card-grid">
              {topics.map((topic) => (
                <DossierCard
                  className="skill-library-card topic-index-card"
                  key={topic.id}
                >
                  <h3>
                    <Link href={getTopicHubPath(topic.id, locale)}>
                      {topic.name}
                    </Link>
                  </h3>
                  <p className="skill-library-card__summary">
                    {topic.description}
                  </p>
                  <RelationDensity
                    label={copy.densityLabel}
                    items={[
                      { n: topic.technologyCount, label: copy.densitySignals },
                      { n: topic.skillCount, label: copy.densitySkills },
                      { n: topic.knowledgeCount, label: copy.densityKnowledge }
                    ]}
                  />
                  <Link
                    className="skill-library-card__link"
                    href={getTopicHubPath(topic.id, locale)}
                  >
                    {copy.open}
                  </Link>
                </DossierCard>
              ))}
            </div>
          </div>
        </>
      )}
    </UserPageShell>
  );
}
