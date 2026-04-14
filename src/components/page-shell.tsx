import type { ReactNode } from "react";

interface PageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({
  title,
  description,
  actions,
  children
}: PageShellProps) {
  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">AI Tech Radar Prototype</p>
          <h1>{title}</h1>
          {description ? <p className="page-description">{description}</p> : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
