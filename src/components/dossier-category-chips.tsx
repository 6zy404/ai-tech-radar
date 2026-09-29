import { DossierStampTag } from "@/components/dossier-stamp-tag";

export interface DossierCategoryOption {
  value: string;
  label: string;
  /** Link target; when every option has one, the chips need no JS. */
  href?: string;
  /** Drawn but not selectable (e.g. a category with no results). */
  disabled?: boolean;
}

interface DossierCategoryChipsProps {
  options: DossierCategoryOption[];
  active: string;
  onChange?: (value: string) => void;
  className?: string;
  /** Names the row for assistive tech when the chips are links. */
  ariaLabel?: string;
}

/**
 * Stamp-style category filter chips, matching the tag-filter chips on
 * /technologies. Toggle buttons when given `onChange` (/network,
 * /technologies); links when the options carry `href` (/search, which is
 * server-rendered and must filter without JS).
 */
export function DossierCategoryChips({
  options,
  active,
  onChange,
  className = "",
  ariaLabel
}: DossierCategoryChipsProps) {
  const chips = options.map((option) => (
    <DossierStampTag
      key={option.value}
      active={option.value === active}
      href={option.href}
      disabled={option.disabled}
      onClick={
        onChange && !option.href ? () => onChange(option.value) : undefined
      }
    >
      {option.label}
    </DossierStampTag>
  ));
  const classes = `dossier-category-chips ${className}`.trim();

  return ariaLabel ? (
    <nav className={classes} aria-label={ariaLabel}>
      {chips}
    </nav>
  ) : (
    <div className={classes}>{chips}</div>
  );
}
