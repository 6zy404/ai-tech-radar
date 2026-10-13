import Link from "next/link";
import type { ReactNode } from "react";

interface DossierStampTagProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  /** A filter chip that navigates instead of toggling: works without JS. */
  href?: string;
  /** An interactive chip with nothing behind it: drawn, but not a control. */
  disabled?: boolean;
  className?: string;
  /** `lang` of the label when it differs from the page's. */
  lang?: string;
}

/**
 * Staged "编辑桌" rubber-stamp label — used as a static tag/priority badge;
 * given onClick, as a toggleable filter chip; given href, as a filter chip
 * that is a link (the server-rendered /search type filter). See
 * docs/design-system.md → "Dossier direction (staged)".
 */
export function DossierStampTag({
  children,
  active = false,
  onClick,
  href,
  disabled = false,
  className = "",
  lang
}: DossierStampTagProps) {
  // A disabled chip is still drawn as a control: it sits in a row of them.
  const interactive = Boolean(onClick || href || disabled);
  const classes = [
    "dossier-stamp-tag",
    interactive ? "dossier-stamp-tag--interactive" : "",
    active ? "dossier-stamp-tag--on" : "",
    disabled ? "dossier-stamp-tag--disabled" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  if (disabled) {
    return (
      <span className={classes} aria-disabled="true" lang={lang}>
        {children}
      </span>
    );
  }

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        aria-current={active ? "page" : undefined}
        lang={lang}
      >
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        aria-pressed={active}
        onClick={onClick}
        lang={lang}
      >
        {children}
      </button>
    );
  }

  return (
    <span className={classes} lang={lang}>
      {children}
    </span>
  );
}
