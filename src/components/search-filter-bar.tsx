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
  priorityValue?: string;
  onPriorityChange?: (value: string) => void;
  typeOptions: FilterOption[];
  tagOptions: FilterOption[];
  priorityOptions?: FilterOption[];
  labels?: {
    search?: string;
    searchPlaceholder?: string;
    type?: string;
    tag?: string;
    priority?: string;
  };
}

export function SearchFilterBar({
  searchValue,
  onSearchChange,
  typeValue,
  onTypeChange,
  tagValue,
  onTagChange,
  priorityValue,
  onPriorityChange,
  typeOptions,
  tagOptions,
  priorityOptions,
  labels
}: SearchFilterBarProps) {
  const resolvedLabels = {
    search: "搜索",
    searchPlaceholder: "搜索标题或摘要",
    type: "类型",
    tag: "标签",
    priority: "优先级",
    ...labels
  };
  const hasPriorityFilter =
    Boolean(priorityOptions?.length) &&
    typeof priorityValue === "string" &&
    typeof onPriorityChange === "function";

  return (
    <div
      className={`search-filter-bar${hasPriorityFilter ? " search-filter-bar--with-priority" : ""}`}
    >
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
        <select
          value={tagValue}
          onChange={(event) => onTagChange(event.target.value)}
        >
          {tagOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {hasPriorityFilter ? (
        <label className="field">
          <span>{resolvedLabels.priority}</span>
          <select
            value={priorityValue}
            onChange={(event) => onPriorityChange?.(event.target.value)}
          >
            {priorityOptions?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
