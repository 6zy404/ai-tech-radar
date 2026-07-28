"use client";

interface ReadFilterToggleProps {
  readCount: number;
  hideRead: boolean;
  onToggle: () => void;
}

/**
 * The "已读 N 条 / 隐藏已读" switch shared by the signal list views. Renders
 * nothing until the reader has marked something, so a first-time reader
 * never sees a control for a state they do not have yet.
 */
export function ReadFilterToggle({
  readCount,
  hideRead,
  onToggle
}: ReadFilterToggleProps) {
  if (readCount === 0) {
    return null;
  }

  return (
    <div className="read-filter-toggle">
      <span className="read-filter-toggle__count">已读 {readCount} 条</span>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={hideRead}
        className={`read-filter-toggle__button${
          hideRead ? " read-filter-toggle__button--active" : ""
        }`}
      >
        {hideRead ? "显示已读" : "隐藏已读"}
      </button>
    </div>
  );
}
