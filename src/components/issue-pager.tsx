import Link from "next/link";

import { technologyDetailCopy } from "@/lib/i18n/copy/technology-detail";
import type { Locale } from "@/lib/i18n/locale";

export interface IssuePagerTarget {
  href: string;
  /** The other issue's date or week range, shown so a reader can judge it. */
  label: string;
}

interface IssuePagerProps {
  /** 期 for daily digests, 周 for weekly reviews, 条 for signals. */
  unit: "期" | "周" | "条";
  ariaLabel: string;
  previous?: IssuePagerTarget;
  next?: IssuePagerTarget;
  /** `lang` of the two labels when they are not in the page's language. */
  previousLang?: string;
  nextLang?: string;
  locale?: Locale;
}

// 上一期 / 下一期 (and 上一周 / 下一周) at the foot of a dated issue. Shared by
// the daily digest and weekly review pages so the two siblings page the same
// way, and by the signal page (上一条 / 下一条, in the 精选 list's order).
// Renders nothing when there is no neighbour on either side; a missing
// side leaves its slot empty so the other link keeps its position.
export function IssuePager({
  unit,
  ariaLabel,
  previous,
  next,
  previousLang,
  nextLang,
  locale = "zh"
}: IssuePagerProps) {
  if (!previous && !next) {
    return null;
  }

  const copy = technologyDetailCopy[locale].pager;

  return (
    <nav className="issue-pager" aria-label={ariaLabel}>
      {previous ? (
        <Link
          href={previous.href}
          rel="prev"
          className="action-link issue-pager__link issue-pager__link--previous"
        >
          <span className="issue-pager__direction">{copy.previous(unit)}</span>{" "}
          <span className="issue-pager__label" lang={previousLang}>
            {previous.label}
          </span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      {next ? (
        <Link
          href={next.href}
          rel="next"
          className="action-link issue-pager__link issue-pager__link--next"
        >
          <span className="issue-pager__direction">{copy.next(unit)}</span>{" "}
          <span className="issue-pager__label" lang={nextLang}>
            {next.label}
          </span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}
