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
  sectionLabel = "内部编辑工作台",
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
        <aside className="workspace-security-note" aria-label="工作台边界提示">
          {securityNote ?? (
            <>
              <strong>内部工作台。</strong>对外部署前请用{" "}
              <code>WORKSPACE_ACCESS_TOKEN</code>{" "}
              保护本区域。投递端点与本地数据路径属于敏感信息；每个数据目录只保留一个任务运行器。
            </>
          )}
        </aside>
        {children}
      </div>
    </div>
  );
}
