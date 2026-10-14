import { ChineseOnlyNote } from "@/components/chinese-only-note";
import { JsonLd } from "@/components/json-ld";
import { RadarView } from "@/components/radar-view";
import { UserPageShell } from "@/components/user-page-shell";
import { radarCopy } from "@/lib/i18n/copy/radar";
import type { Locale } from "@/lib/i18n/locale";
import { getPublicRadar } from "@/lib/radar";
import {
  getRadarRingDescription,
  getRadarRingLabel,
  radarRings
} from "@/lib/radar-labels";
import { layoutRadarDots, type RadarDotPosition } from "@/lib/radar-layout";
import { buildPageMetadata } from "@/lib/site-metadata";
import { buildRadarJsonLd } from "@/lib/structured-data";

export function getRadarPageMetadata(locale: Locale) {
  const copy = radarCopy[locale];

  return buildPageMetadata({
    title: copy.title,
    description: copy.description,
    path: "/radar",
    locale
  });
}

// The /topics and /sources list skeleton — header label, one-line lede, a
// caption row of counts — through the /skills classes, then the picture and
// its list. Everything below comes from getPublicRadar(), the one mapping
// from radar entries to public fields.
export function RadarPage({ locale }: { locale: Locale }) {
  const copy = radarCopy[locale];
  const { entries, edition } = getPublicRadar(locale);
  // Laid out on the server and handed over as a plain object; the client
  // only draws it, so every browser shows the same picture.
  const positions: Record<string, RadarDotPosition> = Object.fromEntries(
    [
      ...layoutRadarDots(
        entries.map((entry) => ({
          id: entry.slug,
          quadrant: entry.quadrant,
          ring: entry.ring
        }))
      ).values()
    ].map((position) => [position.id, position])
  );
  const ringCounts = radarRings.map(
    (ring) => entries.filter((entry) => entry.ring === ring).length
  );
  const changedCount = entries.filter(
    (entry) => entry.change !== "unchanged"
  ).length;

  return (
    <UserPageShell
      title={copy.title}
      description={copy.description}
      sectionLabel={copy.sectionLabel}
      className="skills-library-page radar-page dossier"
    >
      {entries.length === 0 ? (
        <section className="skills-library-empty">
          <p className="eyebrow user-eyebrow">{copy.emptyEyebrow}</p>
          <h2>{copy.emptyTitle}</h2>
          <p>{copy.emptyBody}</p>
        </section>
      ) : (
        <>
          <JsonLd
            data={buildRadarJsonLd(
              {
                title: copy.title,
                description: copy.description,
                latestDate: edition.latestDate
              },
              entries,
              undefined,
              locale
            )}
          />
          <section className="skills-library-intro">
            <div className="skills-library-intro__copy">
              <p>{copy.intro}</p>
            </div>
            <dl className="skills-library-stats" aria-label={copy.statsLabel}>
              <div>
                <dt>{entries.length}</dt>
                <dd>{copy.statEntries}</dd>
              </div>
              {radarRings.map((ring, index) => (
                <div key={ring}>
                  <dt>{ringCounts[index]}</dt>
                  <dd>{getRadarRingLabel(ring, locale)}</dd>
                </div>
              ))}
              <div>
                <dt>
                  <time dateTime={edition.latestDate}>
                    {edition.latestDate}
                  </time>
                </dt>
                <dd>
                  {edition.isFirstEdition
                    ? copy.firstEdition
                    : changedCount > 0
                      ? copy.updatedWithChanges(changedCount)
                      : copy.updated}
                </dd>
              </div>
            </dl>
          </section>

          <ChineseOnlyNote locale={locale}>{copy.chineseOnly}</ChineseOnlyNote>

          <RadarView entries={entries} positions={positions} />

          <section className="radar-rings" aria-labelledby="radar-rings-title">
            <h2 id="radar-rings-title">{copy.ringsHeading}</h2>
            <dl>
              {radarRings.map((ring) => (
                <div key={ring}>
                  <dt>{getRadarRingLabel(ring, locale)}</dt>
                  <dd>{getRadarRingDescription(ring, locale)}</dd>
                </div>
              ))}
            </dl>
            <p>
              <small>{copy.ringsNote}</small>
            </p>
          </section>
        </>
      )}
    </UserPageShell>
  );
}
