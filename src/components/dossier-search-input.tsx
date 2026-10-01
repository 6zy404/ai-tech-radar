interface DossierSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Set it when the box sits in a <form> that must submit without JS. */
  name?: string;
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
  className = "",
  name
}: DossierSearchInputProps) {
  return (
    <div className={`dossier-search ${className}`.trim()}>
      <SearchGlyph />
      <input
        type="search"
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
import { SearchGlyph } from "@/components/search-glyph";
