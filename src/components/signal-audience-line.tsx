import { commonCopy } from "@/lib/i18n/copy/common";
import type { Locale } from "@/lib/i18n/locale";
import { contentLangAttr } from "@/lib/i18n/text-lang";

interface SignalAudienceLineProps {
  /** `whoShouldCare` as the editors wrote it; blanks are dropped. */
  audience: string[];
  locale: Locale;
  className: string;
  /** How many names to show. */
  limit?: number;
}

/**
 * 适合 A、B、C — who should care, as one line of text, shared by the home,
 * list and digest signal cards. The names are the editors' Chinese, so the
 * English site keeps the label in English and marks the names `zh-CN`.
 * Renders nothing when there is no one to name.
 */
export function SignalAudienceLine({
  audience,
  locale,
  className,
  limit = 3
}: SignalAudienceLineProps) {
  const names = audience
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .slice(0, limit);

  if (names.length === 0) {
    return null;
  }

  const copy = commonCopy[locale].audience;
  const joined = names.join(copy.join);

  return (
    <p className={className}>
      {locale === "zh" ? (
        copy.label(joined)
      ) : (
        <>
          {copy.label("")}
          <span lang={contentLangAttr(locale)}>{joined}</span>
        </>
      )}
    </p>
  );
}
