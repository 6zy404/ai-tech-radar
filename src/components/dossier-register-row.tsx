import Link from "next/link";

interface DossierRegisterRowProps {
  title: string;
  date?: string;
  href?: string;
  tag?: string;
  className?: string;
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
  className = ""
}: DossierRegisterRowProps) {
  const titleNode = href ? <Link href={href}>{title}</Link> : title;

  return (
    <div className={`dossier-register-row ${className}`.trim()}>
      {date ? <time>{date}</time> : <span aria-hidden="true" />}
      <h4>{titleNode}</h4>
      {tag ? <span className="dossier-register-row__tag">{tag}</span> : null}
    </div>
  );
}
