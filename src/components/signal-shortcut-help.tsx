"use client";

import { useEffect, useRef } from "react";

interface SignalShortcutHelpProps {
  open: boolean;
  onClose: () => void;
  /** Polite live-region text from useSignalShortcuts. */
  announcement: string;
}

const shortcuts: { keys: string[]; label: string }[] = [
  { keys: ["j", "k"], label: "下一条 / 上一条信号" },
  { keys: ["Enter", "o"], label: "打开当前信号" },
  { keys: ["s"], label: "加入或移出稍后读" },
  { keys: ["x"], label: "标为已读或取消" },
  { keys: ["?"], label: "打开这份说明" },
  { keys: ["Esc"], label: "关闭说明" }
];

/**
 * The ? overlay listing the signal-list shortcuts, plus the live region that
 * tells a screen reader what s / x just did. A native modal <dialog>: it
 * traps focus, makes the page behind it inert and closes on Esc by itself.
 */
export function SignalShortcutHelp({
  open,
  onClose,
  announcement
}: SignalShortcutHelpProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Every way out calls this directly. The dialog's own close event is only
  // a fallback: it is queued as a task, and measured in a backgrounded tab it
  // had not fired 100ms later, which left `open` stuck true and the list
  // keys dead after Esc. `cancel` (Esc) fires synchronously.
  const handleClose = () => {
    if (!returnFocusRef.current && !open) {
      return;
    }

    onClose();
    dialogRef.current?.close();
    // Back to the card the reader was on, not to the top of the page.
    returnFocusRef.current?.focus({ preventScroll: true });
    returnFocusRef.current = null;
  };

  return (
    <>
      <dialog
        ref={dialogRef}
        className="signal-shortcut-help"
        aria-labelledby="signal-shortcut-help-title"
        data-signal-shortcut-help=""
        onCancel={(event) => {
          event.preventDefault();
          handleClose();
        }}
        onClose={handleClose}
        onClick={(event) => {
          // A click on the backdrop lands on the dialog element itself.
          if (event.target === event.currentTarget) {
            handleClose();
          }
        }}
      >
        <div className="signal-shortcut-help__panel">
          <h2
            id="signal-shortcut-help-title"
            className="signal-shortcut-help__title"
          >
            键盘快捷键
          </h2>
          <dl className="signal-shortcut-help__list">
            {shortcuts.map((item) => (
              <div key={item.label} className="signal-shortcut-help__row">
                <dt>
                  {item.keys.map((key, index) => (
                    <span key={key}>
                      {index > 0 ? (
                        <span className="signal-shortcut-help__or">/</span>
                      ) : null}
                      <kbd>{key}</kbd>
                    </span>
                  ))}
                </dt>
                <dd>{item.label}</dd>
              </div>
            ))}
          </dl>
          <p className="signal-shortcut-help__note">
            在输入框里打字，或按着 Ctrl、Alt、⌘ 时，这些键照常使用。
          </p>
          <div className="signal-shortcut-help__actions">
            <button
              type="button"
              className="signal-shortcut-help__close"
              onClick={handleClose}
            >
              关闭
            </button>
          </div>
        </div>
      </dialog>
      <p
        className="signal-shortcut-help__live"
        aria-live="polite"
        role="status"
      >
        {announcement}
      </p>
    </>
  );
}

interface SignalShortcutHintProps {
  onOpen: () => void;
}

/**
 * The one visible trace of the shortcuts: a quiet button at the end of a
 * row that is already on the page, so it adds no line and moves nothing.
 * Hidden on narrow screens, which are almost always touch.
 */
export function SignalShortcutHint({ onOpen }: SignalShortcutHintProps) {
  return (
    <button
      type="button"
      className="signal-shortcut-hint"
      onClick={onOpen}
      aria-haspopup="dialog"
    >
      快捷键 <kbd>?</kbd>
    </button>
  );
}
