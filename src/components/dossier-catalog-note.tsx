import type { ReactNode } from "react";

interface DossierCatalogNoteProps {
  children: ReactNode;
  label?: string;
  className?: string;
}

/**
 * Staged "附注" cross-reference note — a dashed-border annotation that
 * explains *why* a related item is connected, not just that it is.
 * Not yet used by any page; see docs/design-system.md → "Dossier
 * direction (staged)".
 */
export function DossierCatalogNote({
  children,
  label = "附注",
  className = ""
}: DossierCatalogNoteProps) {
  return (
    <div className={`dossier-catalog-note ${className}`.trim()}>
      <span className="dossier-catalog-note__label">{label}</span>
      {children}
    </div>
  );
}
