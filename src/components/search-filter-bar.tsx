"use client";

interface FilterOption {
  value: string;
  label: string;
}

interface SearchFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  typeValue: string;
  onTypeChange: (value: string) => void;
  tagValue: string;
  onTagChange: (value: string) => void;
  typeOptions: FilterOption[];
  tagOptions: FilterOption[];
}

export function SearchFilterBar({
  searchValue,
  onSearchChange,
  typeValue,
  onTypeChange,
  tagValue,
  onTagChange,
  typeOptions,
  tagOptions
}: SearchFilterBarProps) {
  return (
    <div className="search-filter-bar">
      <label className="field">
        <span>Search</span>
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search title or summary"
        />
      </label>
      <label className="field">
        <span>Type</span>
        <select
          value={typeValue}
          onChange={(event) => onTypeChange(event.target.value)}
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Tag</span>
        <select value={tagValue} onChange={(event) => onTagChange(event.target.value)}>
          {tagOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
