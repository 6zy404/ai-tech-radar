// The English twin of src/app/technologies/[slug]/opengraph-image.tsx: the same card
// with English interface text (share-card.ts, `locale`).
import { getTechnologyBySlug } from "@/lib/content";
import { buildShareCard, shareCardSize } from "@/lib/share-card";
import {
  renderShareCardImage,
  shareCardContentType
} from "@/lib/share-card-image";

// The share card a link preview shows for a signal page. What it says lives
// in src/lib/share-card.ts, how it is painted in src/lib/share-card-image.tsx.

export const alt = "AI Tech Radar signal card";
export const size = shareCardSize;
export const contentType = shareCardContentType;

export default async function Image({ params }: { params: { slug: string } }) {
  return renderShareCardImage(
    buildShareCard(getTechnologyBySlug(params.slug), "en")
  );
}
