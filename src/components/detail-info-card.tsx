import type { ReactNode } from "react";

interface DetailInfoRow {
  label: string;
  value: ReactNode;
}

interface DetailInfoCardProps {
  title: string;
  rows: DetailInfoRow[];
  className?: string;
}

export function DetailInfoCard({
  title,
  rows,
  className = ""
}: DetailInfoCardProps) {
  return (
    <section className={`detail-panel detail-info-card ${className}`.trim()}>
      <h2>{title}</h2>
      <div className="detail-info-card__rows">
        {rows.map((row) => (
          <div key={row.label} className="detail-info-card__row">
            <span className="detail-info-card__label">{row.label}</span>
            <div className="detail-info-card__value">{row.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
