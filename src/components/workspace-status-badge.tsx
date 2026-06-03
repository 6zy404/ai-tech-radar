interface WorkspaceStatusBadgeProps {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}

const toneClassName: Record<NonNullable<WorkspaceStatusBadgeProps["tone"]>, string> = {
  neutral: "status-badge--neutral",
  success: "status-badge--success",
  warning: "status-badge--warning",
  danger: "status-badge--danger",
  info: "status-badge--new"
};

export function WorkspaceStatusBadge({
  label,
  tone = "neutral"
}: WorkspaceStatusBadgeProps) {
  return (
    <span className={`status-badge ${toneClassName[tone]}`}>{label}</span>
  );
}
