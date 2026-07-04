import type { ReactNode } from "react";

import { PageHeader } from "@/components/page-header";

interface UserPageShellProps {
  title: string;
  description?: string;
  sectionLabel?: string;
  actions?: ReactNode;
  showHeader?: boolean;
  className?: string;
  children: ReactNode;
}

export function UserPageShell({
  title,
  description,
  sectionLabel = "Technology Signals",
  actions,
  showHeader = true,
  className,
  children
}: UserPageShellProps) {
  return (
    <div
      className={`user-shell${showHeader ? "" : " user-shell--detail"}${className ? ` ${className}` : ""}`}
    >
      {showHeader ? (
        <PageHeader
          variant="user"
          title={title}
          description={description}
          sectionLabel={sectionLabel}
          actions={actions}
        />
      ) : null}
      {children}
    </div>
  );
}
