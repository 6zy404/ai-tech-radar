import type { ReactNode } from "react";

import type { Locale } from "@/lib/i18n/locale";

interface DossierCatalogNoteProps {
  children: ReactNode;
  label?: string;
  className?: string;
  /** Picks the default label (附注 / Note) when `label` is not given. */
  locale?: Locale;
}

const defaultLabels: Record<Locale, string> = { zh: "附注", en: "Note" };

/**
 * Staged "附注" cross-reference note — a dashed-border annotation that
 * explains *why* a related item is connected, not just that it is.
 * Not yet used by any page; see docs/design-system.md → "Dossier
 * direction (staged)".
 */
export function DossierCatalogNote({
  children,
  label,
  className = "",
  locale = "zh"
}: DossierCatalogNoteProps) {
  return (
    <div className={`dossier-catalog-note ${className}`.trim()}>
      <span className="dossier-catalog-note__label">
        {label ?? defaultLabels[locale]}
      </span>
      {children}
    </div>
  );
}
