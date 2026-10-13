import Link from "next/link";
import type { ReactNode } from "react";

interface DossierRegisterRowProps {
  title: string;
  date?: string;
  href?: string;
  tag?: string;
  className?: string;
  /** The title's heading level, one below the heading of the list it sits
   * in. Defaults to 4, what every row rendered before the prop existed. */
  headingLevel?: 3 | 4;
  /** A second line under the title, in the title's column (an excerpt). */
  children?: ReactNode;
  /** `lang` of the title / the detail line when it differs from the page. */
  titleLang?: string;
  detailLang?: string;
}

/**
 * Staged register/ledger row — a compact date + title + tag line used
 * for archive, timeline, and relationship lists. Not yet used by any
 * page; see docs/design-system.md → "Dossier direction (staged)".
 */
export function DossierRegisterRow({
  title,
  date,
  href,
  tag,
  className = "",
  headingLevel = 4,
  children,
  titleLang,
  detailLang
}: DossierRegisterRowProps) {
  const titleNode = href ? <Link href={href}>{title}</Link> : title;
  const Heading = headingLevel === 3 ? "h3" : "h4";

  return (
    <div className={`dossier-register-row ${className}`.trim()}>
      {date ? <time>{date}</time> : <span aria-hidden="true" />}
      <Heading className="dossier-register-row__title" lang={titleLang}>
        {titleNode}
      </Heading>
      {tag ? <span className="dossier-register-row__tag">{tag}</span> : null}
      {children ? (
        <div className="dossier-register-row__detail" lang={detailLang}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
