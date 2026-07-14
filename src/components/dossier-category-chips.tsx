import { DossierStampTag } from "@/components/dossier-stamp-tag";

export interface DossierCategoryOption {
  value: string;
  label: string;
}

interface DossierCategoryChipsProps {
  options: DossierCategoryOption[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Staged stamp-style category filter chips — the confirmed direction,
 * matching the tag-filter chips already used on /technologies and
 * /radar. Not yet used by any page; see docs/design-system.md →
 * "Dossier direction (staged)".
 */
export function DossierCategoryChips({
  options,
  active,
  onChange,
  className = ""
}: DossierCategoryChipsProps) {
  return (
    <div className={`dossier-category-chips ${className}`.trim()}>
      {options.map((option) => (
        <DossierStampTag
          key={option.value}
          active={option.value === active}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </DossierStampTag>
      ))}
    </div>
  );
}
