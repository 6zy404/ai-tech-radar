import { JsonLd } from "@/components/json-ld";
import { RadarView } from "@/components/radar-view";
import { UserPageShell } from "@/components/user-page-shell";
import { getPublicRadar } from "@/lib/radar";
import {
  getRadarRingDescription,
  getRadarRingLabel,
  radarRings
} from "@/lib/radar-labels";
import { layoutRadarDots, type RadarDotPosition } from "@/lib/radar-layout";
import { buildPageMetadata } from "@/lib/site-metadata";
import { buildRadarJsonLd } from "@/lib/structured-data";

// Reads runtime content (the radar overlay and the published pools), so it
// must never be prerendered: a build-time copy would freeze the radar on the
// day the build ran. See CHANGELOG - "Five public pages would have shipped
// frozen at build time".
export const dynamic = "force-dynamic";

const pageTitle = "技术雷达";
const pageDescription =
  "站内信号里反复出现的技术，按四个象限、四个环位放好，每一项都附上它所依据的信号。";

export const metadata = buildPageMetadata({
  title: pageTitle,
  description: pageDescription,
  path: "/radar"
});

// The /topics and /sources list skeleton — header label, one-line lede, a
// caption row of counts — through the /skills classes, then the picture and
// its list. Everything below comes from getPublicRadar(), the one mapping
// from radar entries to public fields.
export default function RadarPage() {
  const { entries, edition } = getPublicRadar();
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
      title={pageTitle}
      description={pageDescription}
      sectionLabel="雷达"
      className="skills-library-page radar-page dossier"
    >
      {entries.length === 0 ? (
        <section className="skills-library-empty">
          <p className="eyebrow user-eyebrow">暂无条目</p>
          <h2>雷达上还没有技术。</h2>
          <p>条目发布并关联已发布的信号后，会在这里按象限和环位排开。</p>
        </section>
      ) : (
        <>
          <JsonLd
            data={buildRadarJsonLd(
              {
                title: pageTitle,
                description: pageDescription,
                latestDate: edition.latestDate
              },
              entries
            )}
          />
          <section className="skills-library-intro">
            <div className="skills-library-intro__copy">
              {/* One line on purpose: JSX joins wrapped text lines with a
                  space, which lands in the middle of a Chinese sentence. */}
              <p>
                环位越靠里越值得现在就用；点开一项，能看到它为什么在这一环、依据哪几条信号、环位怎么变过。
              </p>
            </div>
            <dl className="skills-library-stats" aria-label="雷达概览">
              <div>
                <dt>{entries.length}</dt>
                <dd>项技术</dd>
              </div>
              {radarRings.map((ring, index) => (
                <div key={ring}>
                  <dt>{ringCounts[index]}</dt>
                  <dd>{getRadarRingLabel(ring)}</dd>
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
                    ? "首期"
                    : changedCount > 0
                      ? `更新，本期 ${changedCount} 项新进或移动`
                      : "更新"}
                </dd>
              </div>
            </dl>
          </section>

          <RadarView entries={entries} positions={positions} />

          <section className="radar-rings" aria-labelledby="radar-rings-title">
            <h2 id="radar-rings-title">四个环位</h2>
            <dl>
              {radarRings.map((ring) => (
                <div key={ring}>
                  <dt>{getRadarRingLabel(ring)}</dt>
                  <dd>{getRadarRingDescription(ring)}</dd>
                </div>
              ))}
            </dl>
            <p>
              <small>
                本期指雷达最近一次改动之前的 30
                天；首期的条目都算基线，不标新进。
              </small>
            </p>
          </section>
        </>
      )}
    </UserPageShell>
  );
}
