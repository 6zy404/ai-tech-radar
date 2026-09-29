import { getTodayDateString } from "@/lib/digest-store";
import { toDigestShareCardInput } from "@/lib/digest-view";
import {
  getLatestPublishedDailyDigest,
  getPublishedDailyDigestByDate
} from "@/lib/digest-workflow";
import { buildDigestShareCard, shareCardSize } from "@/lib/share-card";
import {
  loadShareCardGlyphCheck,
  renderShareCardImage,
  shareCardContentType
} from "@/lib/share-card-image";

// Share card for /digest/today: the issue the page shows — today's, else the
// latest published — or the site card before the first one is published.

export const alt = "AI Tech Radar 技术简报卡片";
export const size = shareCardSize;
export const contentType = shareCardContentType;

// With no route params, `next build` prerendered this once and never
// regenerated it (initialRevalidateSeconds: false), so the card stayed on
// whichever issue was latest when the build ran.
export const dynamic = "force-dynamic";

export default async function Image() {
  const digest =
    getPublishedDailyDigestByDate(getTodayDateString()) ??
    getLatestPublishedDailyDigest();

  // The issue behind this URL changes with every publish, so the card is
  // cached no longer than a fallback card is.
  return renderShareCardImage(
    buildDigestShareCard(digest ? toDigestShareCardInput(digest) : undefined, {
      canDraw: await loadShareCardGlyphCheck()
    }),
    { maxAge: 300 }
  );
}
