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
  labels?: {
    search?: string;
    searchPlaceholder?: string;
    type?: string;
    tag?: string;
  };
}

export function SearchFilterBar({
  searchValue,
  onSearchChange,
  typeValue,
  onTypeChange,
  tagValue,
  onTagChange,
  typeOptions,
  tagOptions,
  labels
}: SearchFilterBarProps) {
  const resolvedLabels = {
    search: "Search",
    searchPlaceholder: "Search title or summary",
    type: "Type",
    tag: "Tag",
    ...labels
  };

  return (
    <div className="search-filter-bar">
      <label className="field">
        <span>{resolvedLabels.search}</span>
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={resolvedLabels.searchPlaceholder}
        />
      </label>
      <label className="field">
        <span>{resolvedLabels.type}</span>
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
        <span>{resolvedLabels.tag}</span>
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
