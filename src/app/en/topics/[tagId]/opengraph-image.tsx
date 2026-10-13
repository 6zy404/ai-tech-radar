// The English twin of src/app/topics/[tagId]/opengraph-image.tsx: the same card
// with English interface text (share-card.ts, `locale`).
import { buildTopicShareCard, shareCardSize } from "@/lib/share-card";
import {
  renderShareCardImage,
  shareCardContentType
} from "@/lib/share-card-image";
import { getTopicHub } from "@/lib/topic-hub";

// Share card for a topic hub; an unknown topic or one with nothing
// published gets the site card, as the page itself 404s.

export const alt = "AI Tech Radar topic card";
export const size = shareCardSize;
export const contentType = shareCardContentType;

export default async function Image({ params }: { params: { tagId: string } }) {
  return renderShareCardImage(
    buildTopicShareCard(getTopicHub(params.tagId, "en"), "en")
  );
}
