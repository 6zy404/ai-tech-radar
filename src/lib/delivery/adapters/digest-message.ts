import { buildDailyDigestWebhookPayload } from "@/lib/delivery/digest-payload";
import type { DailyDigestWebhookTechnology } from "@/lib/delivery/digest-payload";
import type { DailyDigest } from "@/types/content";

// The content every chat-style channel (Feishu, Telegram, Discord) sends:
// the published digest's title, date, summary, the first three
// 立即关注 and 值得跟踪 items and the public link. Nothing else from the
// digest or the channel reaches these messages.

export const chatMessageItemLimit = 3;
export const ellipsis = "…";

export interface DigestChatMessage {
  title: string;
  date: string;
  summary: string;
  digestUrl: string;
  highPriorityItems: DailyDigestWebhookTechnology[];
  watchItems: DailyDigestWebhookTechnology[];
}

export function buildDigestChatMessage(
  digest: DailyDigest,
  deliveredAt: string
): DigestChatMessage {
  const payload = buildDailyDigestWebhookPayload(digest, deliveredAt);

  return {
    title: payload.title,
    date: payload.digestDate,
    summary: payload.summary,
    digestUrl: payload.digestUrl,
    highPriorityItems: payload.highPriorityItems.slice(0, chatMessageItemLimit),
    watchItems: payload.watchItems.slice(0, chatMessageItemLimit)
  };
}

/** Cuts plain text to `maxLength` UTF-16 units, ending in an ellipsis. */
export function truncatePlainText(value: string, maxLength: number): string {
  const text = value.trim();

  if (text.length <= maxLength) {
    return text;
  }

  // Never leave half of a surrogate pair behind.
  let cut = maxLength - ellipsis.length;

  if (/[\uD800-\uDBFF]/.test(text.charAt(cut - 1))) {
    cut -= 1;
  }

  return `${text.slice(0, cut).trimEnd()}${ellipsis}`;
}

/**
 * Joins whole blocks with `separator` until the next one would push the
 * result plus `tail` past `limit`; when a block is dropped, an ellipsis line
 * marks the cut. The tail — the digest link — is always kept in full, and a
 * block is never split, so markup inside a block cannot be cut open.
 */
export function fitBlocks(
  blocks: string[],
  tail: string,
  limit: number,
  separator = "\n"
): string {
  const kept: string[] = [];
  let truncated = false;

  for (const block of blocks) {
    const next = [...kept, block].join(separator);

    if (next.length + tail.length <= limit) {
      kept.push(block);
    } else {
      truncated = true;
      break;
    }
  }

  if (truncated) {
    while (
      kept.length > 0 &&
      [...kept, ellipsis].join(separator).length + tail.length > limit
    ) {
      kept.pop();
    }

    kept.push(ellipsis);
  }

  return `${kept.join(separator)}${tail}`;
}
