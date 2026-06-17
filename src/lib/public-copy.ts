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
    return `AI Tech Digest - ${digest.date}`;
  }

  return title;
}

export function getPublicDigestSummary(digest: PublicDigestCopyInput): string {
  const summary =
    digest.editorialSummary?.trim() || digest.summary?.trim() || "";

  if (!summary || containsInternalPublicCopy(summary)) {
    return "Today's brief selects the published technology signals that deserve attention first, then organizes the skills, background concepts, and public sources behind them.";
  }

  return summary;
}
