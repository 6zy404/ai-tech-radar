import { getTechnologyBySlug } from "@/lib/content";
import { buildShareCard, shareCardSize } from "@/lib/share-card";
import {
  renderShareCardImage,
  shareCardContentType
} from "@/lib/share-card-image";

// The share card a link preview shows for a signal page. What it says lives
// in src/lib/share-card.ts, how it is painted in src/lib/share-card-image.tsx.

export const alt = "AI Tech Radar 技术信号卡片";
export const size = shareCardSize;
export const contentType = shareCardContentType;

export default async function Image({ params }: { params: { slug: string } }) {
  return renderShareCardImage(buildShareCard(getTechnologyBySlug(params.slug)));
}
