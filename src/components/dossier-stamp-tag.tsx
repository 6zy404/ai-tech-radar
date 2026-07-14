import type { ReactNode } from "react";

interface DossierStampTagProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Staged "编辑桌" rubber-stamp label — used both as a static tag/priority
 * badge and, when given onClick, as a toggleable filter chip. See
 * docs/design-system.md → "Dossier direction (staged)".
 */
export function DossierStampTag({
  children,
  active = false,
  onClick,
  className = ""
}: DossierStampTagProps) {
  const classes = [
    "dossier-stamp-tag",
    onClick ? "dossier-stamp-tag--interactive" : "",
    active ? "dossier-stamp-tag--on" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        aria-pressed={active}
        onClick={onClick}
      >
        {children}
      </button>
    );
  }

  return <span className={classes}>{children}</span>;
}
