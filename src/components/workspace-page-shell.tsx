import type { ReactNode } from "react";

import { PageHeader } from "@/components/page-header";
import { WorkspaceBreadcrumbs } from "@/components/workspace-breadcrumbs";
import { WorkspaceNav } from "@/components/workspace-nav";

interface WorkspacePageShellProps {
  title: string;
  description?: string;
  sectionLabel?: string;
  actions?: ReactNode;
  className?: string;
  securityNote?: ReactNode;
  children: ReactNode;
}

export function WorkspacePageShell({
  title,
  description,
  sectionLabel = "Internal Editorial Workspace",
  actions,
  className,
  securityNote,
  children
}: WorkspacePageShellProps) {
  return (
    <div className={["workspace-shell", className].filter(Boolean).join(" ")}>
      <WorkspaceNav />
      <div className="workspace-shell__content">
        <WorkspaceBreadcrumbs />
        <PageHeader
          variant="workspace"
          title={title}
          description={description}
          sectionLabel={sectionLabel}
          actions={actions}
        />
        <aside className="workspace-security-note" aria-label="Workspace boundary note">
          {securityNote ?? (
            <>
              <strong>Internal workspace.</strong> Protect with{" "}
              <code>WORKSPACE_ACCESS_TOKEN</code>. Delivery endpoints and local
              data paths are sensitive; keep one task runner active per data
              directory.
            </>
          )}
        </aside>
        {children}
      </div>
    </div>
  );
}
