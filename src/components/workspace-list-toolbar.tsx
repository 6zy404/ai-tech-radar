import type { ReactNode } from "react";

interface WorkspaceListToolbarProps {
  label: string;
  detail?: string;
  actions?: ReactNode;
}

export function WorkspaceListToolbar({
  label,
  detail,
  actions
}: WorkspaceListToolbarProps) {
  return (
    <div className="workspace-list-toolbar">
      <div>
        <strong>{label}</strong>
        {detail ? <p>{detail}</p> : null}
      </div>
      {actions ? (
        <div className="workspace-list-toolbar__actions">{actions}</div>
      ) : null}
    </div>
  );
}
