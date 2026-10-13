// The English twin of src/app/digest/weekly/opengraph-image.tsx: the same card
// with English interface text (share-card.ts, `locale`).
import { buildWeeklyShareCard, shareCardSize } from "@/lib/share-card";
import {
  renderShareCardImage,
  shareCardContentType
} from "@/lib/share-card-image";
import { getWeeklyReview } from "@/lib/weekly-review";

// Share card for /digest/weekly, the current week: the same card as
// /digest/weekly/[week] for this week, or the site card while the week has
// no shown signal yet.

export const alt = "AI Tech Radar weekly review card";
export const size = shareCardSize;
export const contentType = shareCardContentType;

// With no route params, `next build` would otherwise prerender this once and
// never regenerate it, freezing the card on the week the build ran.
export const dynamic = "force-dynamic";

export default async function Image() {
  // The week behind this URL gains signals as they publish and rolls over
  // every Monday, so the card is cached no longer than a fallback card is.
  return renderShareCardImage(buildWeeklyShareCard(getWeeklyReview(), "en"), {
    maxAge: 300
  });
}
