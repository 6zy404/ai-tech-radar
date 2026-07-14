interface DossierSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Staged icon-pill search input — the confirmed direction for site-wide
 * search boxes in the dossier design, chosen over underline / bordered
 * card / request-slip variants during exploration. Not yet used by any
 * page; see docs/design-system.md → "Dossier direction (staged)".
 */
export function DossierSearchInput({
  value,
  onChange,
  placeholder,
  className = ""
}: DossierSearchInputProps) {
  return (
    <div className={`dossier-search ${className}`.trim()}>
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="6.5"
          cy="6.5"
          r="4.5"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <line
          x1="10"
          y1="10"
          x2="13.5"
          y2="13.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
