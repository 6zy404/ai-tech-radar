import Link from "next/link";

export interface IssuePagerTarget {
  href: string;
  /** The other issue's date or week range, shown so a reader can judge it. */
  label: string;
}

interface IssuePagerProps {
  /** 期 for daily digests, 周 for weekly reviews. */
  unit: "期" | "周";
  ariaLabel: string;
  previous?: IssuePagerTarget;
  next?: IssuePagerTarget;
}

// 上一期 / 下一期 (and 上一周 / 下一周) at the foot of a dated issue. Shared by
// the daily digest and weekly review pages so the two siblings page the same
// way. Renders nothing when there is no neighbour on either side; a missing
// side leaves its slot empty so the other link keeps its position.
export function IssuePager({
  unit,
  ariaLabel,
  previous,
  next
}: IssuePagerProps) {
  if (!previous && !next) {
    return null;
  }

  return (
    <nav className="issue-pager" aria-label={ariaLabel}>
      {previous ? (
        <Link
          href={previous.href}
          rel="prev"
          className="action-link issue-pager__link issue-pager__link--previous"
        >
          <span className="issue-pager__direction">← 上一{unit}</span>{" "}
          <span className="issue-pager__label">{previous.label}</span>
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
          <span className="issue-pager__direction">下一{unit} →</span>{" "}
          <span className="issue-pager__label">{next.label}</span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}
