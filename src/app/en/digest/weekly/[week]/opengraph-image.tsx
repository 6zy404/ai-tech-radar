// The English twin of src/app/digest/weekly/[week]/opengraph-image.tsx: the same card
// with English interface text (share-card.ts, `locale`).
import { buildWeeklyShareCard, shareCardSize } from "@/lib/share-card";
import {
  renderShareCardImage,
  shareCardContentType
} from "@/lib/share-card-image";
import { getWeeklyReview } from "@/lib/weekly-review";

// Share card for one week of the weekly review. A non-canonical key or a
// week with no shown signal gets the site card, as the page itself 404s.

export const alt = "AI Tech Radar weekly review card";
export const size = shareCardSize;
export const contentType = shareCardContentType;

export default async function Image({ params }: { params: { week: string } }) {
  return renderShareCardImage(
    buildWeeklyShareCard(getWeeklyReview(params.week), "en")
  );
}
