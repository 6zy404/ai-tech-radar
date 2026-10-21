import { buildSiteShareCard, shareCardSize } from "@/lib/share-card";
import {
  renderShareCardImage,
  shareCardContentType
} from "@/lib/share-card-image";

// The site card for the home page, which until 2026-10-21 shared with no
// image at all (seo-6); `buildSiteShareCard` had only been the fallback for
// an unknown slug. It reaches the home page because the page sits in this
// directory; a page further down (/technologies, /skills …) builds its own
// `openGraph` through buildPageMetadata, which replaces the inherited one,
// so those pages still share without an image (measured on the dev server:
// og:image on / and /en, none on /technologies and /skills). Giving them the
// card is one explicit image per page — left for a later round, as the review
// allowed.

export const alt = "AI Tech Radar";
export const size = shareCardSize;
export const contentType = shareCardContentType;

// The card is built from constants, so rendering it once at build time is
// right; the deployment check still wants the render mode written down
// (src/lib/metadata-route-render-mode.ts).
export const dynamic = "force-static";

export default function Image() {
  return renderShareCardImage(buildSiteShareCard());
}
