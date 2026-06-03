import type { ReactNode } from "react";

interface PageHeaderProps {
  variant: "workspace" | "user";
  title: string;
  description?: string;
  sectionLabel: string;
  actions?: ReactNode;
}

export function PageHeader({
  variant,
  title,
  description,
  sectionLabel,
  actions
}: PageHeaderProps) {
  const prefix = variant === "workspace" ? "workspace" : "user";

  return (
    <header className={`${prefix}-page-header`}>
      <div className={`${prefix}-page-header__copy`}>
        <p className={`eyebrow ${prefix}-eyebrow`}>{sectionLabel}</p>
        <h1>{title}</h1>
        {description ? (
          <p className={`${prefix}-page-header__description`}>{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className={`${prefix}-page-header__actions`}>{actions}</div>
      ) : null}
    </header>
  );
}
