import type { ReactNode } from "react";

interface DossierCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * "编辑桌" (dossier) card — a bordered index-card tile with a flat
 * resting state and a plain hover lift. See docs/design-system.md →
 * "Dossier direction".
 */
export function DossierCard({ children, className = "" }: DossierCardProps) {
  return <div className={`dossier-card ${className}`.trim()}>{children}</div>;
}
