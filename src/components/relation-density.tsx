export interface RelationDensityItem {
  n: number;
  label: string;
}

interface RelationDensityProps {
  items: RelationDensityItem[];
  label?: string;
  className?: string;
}

/**
 * Compact "关联 · N 技术 · N 技能" relationship-density line shared by the
 * technology, skill, and knowledge list cards. Zero-count entries are dropped;
 * renders nothing when there is no relationship to show.
 */
export function RelationDensity({
  items,
  label = "关联",
  className = ""
}: RelationDensityProps) {
  const visible = items.filter((item) => item.n > 0);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className={`relation-density ${className}`.trim()}>
      <span className="relation-density__label">{label}</span>
      {visible.map((item, index) => (
        <span key={item.label}>
          {index > 0 ? <span aria-hidden="true"> · </span> : null}
          <strong>{item.n}</strong> {item.label}
        </span>
      ))}
    </div>
  );
}
