// The English twin of src/app/opengraph-image.tsx: the site card with
// English interface text (share-card.ts, `locale`).
import { buildSiteShareCard, shareCardSize } from "@/lib/share-card";
import {
  renderShareCardImage,
  shareCardContentType
} from "@/lib/share-card-image";

export const alt = "AI Tech Radar";
export const size = shareCardSize;
export const contentType = shareCardContentType;

// Constants only, so rendered once at build time; the deployment check wants
// the render mode written down (src/lib/metadata-route-render-mode.ts).
export const dynamic = "force-static";

export default function Image() {
  return renderShareCardImage(buildSiteShareCard("en"));
}
