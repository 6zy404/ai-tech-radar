"use client";

interface SignalReadingActionsProps {
  isRead: boolean;
  isSaved: boolean;
  onToggleRead: () => void;
  onToggleSaved: () => void;
}

/**
 * The per-signal 稍后读 / 已读 toggle pair rendered on index cards. Both
 * marks are explicit reader actions — opening a signal never marks it read
 * on its own, so a card never changes state without a click.
 */
export function SignalReadingActions({
  isRead,
  isSaved,
  onToggleRead,
  onToggleSaved
}: SignalReadingActionsProps) {
  return (
    <div className="signal-reading-actions">
      <button
        type="button"
        onClick={onToggleSaved}
        aria-pressed={isSaved}
        className={`signal-reading-actions__button${
          isSaved ? " signal-reading-actions__button--active" : ""
        }`}
      >
        {isSaved ? "已加入稍后读" : "稍后读"}
      </button>
      <button
        type="button"
        onClick={onToggleRead}
        aria-pressed={isRead}
        className={`signal-reading-actions__button${
          isRead ? " signal-reading-actions__button--active" : ""
        }`}
      >
        {isRead ? "已读" : "标为已读"}
      </button>
    </div>
  );
}
