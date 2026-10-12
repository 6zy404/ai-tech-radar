import { getPublicRadar } from "@/lib/radar";
import { radarRings } from "@/lib/radar-labels";
import { buildRadarShareCard, shareCardSize } from "@/lib/share-card";
import {
  renderShareCardImage,
  shareCardContentType
} from "@/lib/share-card-image";

// Share card for /radar: the entry count, the ring counts the page prints
// and the date of the newest change; the site card while the radar is empty.

export const alt = "AI Tech Radar 技术雷达卡片";
export const size = shareCardSize;
export const contentType = shareCardContentType;

// With no route params, `next build` would otherwise prerender this once and
// never regenerate it, freezing the card on the radar the build saw.
export const dynamic = "force-dynamic";

export default async function Image() {
  const { entries, edition } = getPublicRadar();

  return renderShareCardImage(
    buildRadarShareCard({
      entryCount: entries.length,
      ringCounts: radarRings.map(
        (ring) => entries.filter((entry) => entry.ring === ring).length
      ),
      latestDate: edition.latestDate
    })
  );
}
