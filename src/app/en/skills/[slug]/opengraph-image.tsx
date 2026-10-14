// The English twin of src/app/skills/[slug]/opengraph-image.tsx: the same card
// with English interface text (share-card.ts, `locale`).
import { getSkillBySlug } from "@/lib/content";
import { buildSkillShareCard, shareCardSize } from "@/lib/share-card";
import {
  renderShareCardImage,
  shareCardContentType
} from "@/lib/share-card-image";

// Share card for a published skill; a draft or unknown slug gets the site
// card, since `getSkillBySlug` reads the published pool only.

export const alt = "AI Tech Radar skill card";
export const size = shareCardSize;
export const contentType = shareCardContentType;

export default async function Image({ params }: { params: { slug: string } }) {
  return renderShareCardImage(
    buildSkillShareCard(getSkillBySlug(params.slug), "en")
  );
}
