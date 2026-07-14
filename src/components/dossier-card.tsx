import type { ReactNode } from "react";

interface DossierCardProps {
  children: ReactNode;
  tilt?: "a" | "b" | "c" | "none";
  className?: string;
}

/**
 * Staged "编辑桌" (dossier) card — a bordered index-card tile with a
 * slight resting tilt that straightens on hover, collapsing to no tilt
 * on narrow screens. Not yet used by any page; see
 * docs/design-system.md → "Dossier direction (staged)".
 */
export function DossierCard({
  children,
  tilt = "none",
  className = ""
}: DossierCardProps) {
  const tiltClass = tilt !== "none" ? ` dossier-card--tilt-${tilt}` : "";

  return (
    <div className={`dossier-card${tiltClass} ${className}`.trim()}>
      {children}
    </div>
  );
}
