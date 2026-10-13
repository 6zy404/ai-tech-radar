// The English twin of src/app/knowledge/[slug]/opengraph-image.tsx: the same card
// with English interface text (share-card.ts, `locale`).
import { getKnowledgeBySlug } from "@/lib/content";
import { buildKnowledgeShareCard, shareCardSize } from "@/lib/share-card";
import {
  renderShareCardImage,
  shareCardContentType
} from "@/lib/share-card-image";

// Share card for a published knowledge item; a draft or unknown slug gets
// the site card, since `getKnowledgeBySlug` reads the published pool only.

export const alt = "AI Tech Radar knowledge card";
export const size = shareCardSize;
export const contentType = shareCardContentType;

export default async function Image({ params }: { params: { slug: string } }) {
  return renderShareCardImage(
    buildKnowledgeShareCard(getKnowledgeBySlug(params.slug), "en")
  );
}
