import { contentBodyToPlainText } from "./content-body";

interface PublicDigestCopyInput {
  date: string;
  title?: string | null;
  summary?: string | null;
  editorialSummary?: string | null;
}

const INTERNAL_COPY_PATTERN =
  /\b(demo|mock|validation|internal|workspace|test)\b|Delivery integration validation/i;

export function containsInternalPublicCopy(value?: string | null): boolean {
  return INTERNAL_COPY_PATTERN.test(value ?? "");
}

export function getPublicDigestTitle(digest: PublicDigestCopyInput): string {
  const title = digest.title?.trim();

  if (!title || containsInternalPublicCopy(title)) {
    return `AI 技术简报 · ${digest.date}`;
  }

  return title;
}

export function getPublicDigestSummary(digest: PublicDigestCopyInput): string {
  const summary =
    digest.editorialSummary?.trim() || digest.summary?.trim() || "";

  if (!summary || containsInternalPublicCopy(summary)) {
    return "今天的简报优先挑选了值得关注的已发布技术信号，并整理了它们背后的技能、背景概念和公开来源。";
  }

  return summary;
}

// The markdown-preserving reader above feeds `ContentBody` on the digest page.
// Every other public consumer of the same string — the home page digest card,
// the `/digest` archive, `/feed.xml` and `/feed.json` — renders it as plain
// text, so it must go through here instead.
export function getPublicDigestSummaryPlainText(
  digest: PublicDigestCopyInput
): string {
  return contentBodyToPlainText(getPublicDigestSummary(digest));
}
