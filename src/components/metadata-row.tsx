import type { ReactNode } from "react";

interface MetadataItem {
  label?: string;
  value: ReactNode;
}

interface MetadataRowProps {
  items: MetadataItem[];
  className?: string;
}

export function MetadataRow({ items, className = "" }: MetadataRowProps) {
  const visibleItems = items.filter((item) => Boolean(item.value));

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <dl className={`metadata-row ${className}`.trim()}>
      {visibleItems.map((item, index) => (
        <div key={`${item.label ?? "meta"}-${index}`} className="metadata-row__item">
          {item.label ? <dt>{item.label}</dt> : null}
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
