import Link from "next/link";

interface DossierRegisterRowProps {
  title: string;
  date?: string;
  href?: string;
  tag?: string;
  className?: string;
  /** The title's heading level, one below the heading of the list it sits
   * in. Defaults to 4, what every row rendered before the prop existed. */
  headingLevel?: 3 | 4;
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
  headingLevel = 4
}: DossierRegisterRowProps) {
  const titleNode = href ? <Link href={href}>{title}</Link> : title;
  const Heading = headingLevel === 3 ? "h3" : "h4";

  return (
    <div className={`dossier-register-row ${className}`.trim()}>
      {date ? <time>{date}</time> : <span aria-hidden="true" />}
      <Heading className="dossier-register-row__title">{titleNode}</Heading>
      {tag ? <span className="dossier-register-row__tag">{tag}</span> : null}
    </div>
  );
}
