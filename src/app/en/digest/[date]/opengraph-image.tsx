// The English twin of src/app/digest/[date]/opengraph-image.tsx: the same card
// with English interface text (share-card.ts, `locale`).
import { toDigestShareCardInput } from "@/lib/digest-view";
import { getPublishedDailyDigestByDate } from "@/lib/digest-workflow";
import { buildDigestShareCard, shareCardSize } from "@/lib/share-card";
import {
  loadShareCardGlyphCheck,
  renderShareCardImage,
  shareCardContentType
} from "@/lib/share-card-image";

// Share card for one published digest. A draft, an archived digest or an
// unknown date gets the site card, as the page itself 404s.

export const alt = "AI Tech Radar briefing card";
export const size = shareCardSize;
export const contentType = shareCardContentType;

export default async function Image({ params }: { params: { date: string } }) {
  const digest = getPublishedDailyDigestByDate(params.date);

  return renderShareCardImage(
    buildDigestShareCard(digest ? toDigestShareCardInput(digest) : undefined, {
      canDraw: await loadShareCardGlyphCheck(),
      locale: "en"
    })
  );
}
