interface PublicDigestCopyInput {
  date: string;
  title?: string | null;
  summary?: string | null;
  editorialSummary?: string | null;
}

const INTERNAL_COPY_PATTERN =
  /\b(demo|mock|validation|internal|workspace)\b|用于演示|仅供演示|验证|测试|Delivery integration validation/i;

export function containsInternalPublicCopy(value?: string | null): boolean {
  return INTERNAL_COPY_PATTERN.test(value ?? "");
}

export function getPublicDigestTitle(digest: PublicDigestCopyInput): string {
  const title = digest.title?.trim();

  if (!title || containsInternalPublicCopy(title)) {
    return `AI Tech Radar 每日技术简报 ${digest.date}`;
  }

  return title;
}

export function getPublicDigestSummary(digest: PublicDigestCopyInput): string {
  const summary =
    digest.editorialSummary?.trim() || digest.summary?.trim() || "";

  if (!summary || containsInternalPublicCopy(summary)) {
    return "今天的简报从已发布技术信号中筛选出需要优先关注的变化，并整理相关技能、背景知识与来源。";
  }

  return summary;
}
