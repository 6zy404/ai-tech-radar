"use client";

import { useEffect, useRef } from "react";

import { useSignalShortcutPreference } from "@/components/use-signal-shortcut-preference";
import { signalsCopy } from "@/lib/i18n/copy/signals";
import { useLocale } from "@/lib/i18n/use-locale";

interface SignalShortcutHelpProps {
  open: boolean;
  onClose: () => void;
  /** Polite live-region text from useSignalShortcuts. */
  announcement: string;
}

type ShortcutKey = keyof (typeof signalsCopy)["zh"]["shortcuts"]["keys"];

const shortcuts: { keys: string[]; labelKey: ShortcutKey }[] = [
  { keys: ["j", "k"], labelKey: "move" },
  { keys: ["Enter", "o"], labelKey: "open" },
  { keys: ["s"], labelKey: "save" },
  { keys: ["x"], labelKey: "read" },
  { keys: ["?"], labelKey: "help" },
  { keys: ["Esc"], labelKey: "close" }
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
  const copy = signalsCopy[useLocale()].shortcuts;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [singleKeysEnabled, setSingleKeysEnabled] =
    useSignalShortcutPreference();

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
            {copy.title}
          </h2>
          <dl className="signal-shortcut-help__list">
            {shortcuts.map((item) => (
              <div key={item.labelKey} className="signal-shortcut-help__row">
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
                <dd>{copy.keys[item.labelKey]}</dd>
              </div>
            ))}
          </dl>
          <p className="signal-shortcut-help__note">{copy.note}</p>
          {/* WCAG 2.1.4: single-character shortcuts must be possible to turn
              off. ? stays on either way, so this switch is always reachable. */}
          <label className="signal-shortcut-help__switch">
            <input
              type="checkbox"
              checked={!singleKeysEnabled}
              onChange={(event) =>
                setSingleKeysEnabled(!event.currentTarget.checked)
              }
            />
            <span>
              {copy.switchLabel}
              <span className="signal-shortcut-help__switch-hint">
                {copy.switchHint}
              </span>
            </span>
          </label>
          <div className="signal-shortcut-help__actions">
            <button
              type="button"
              className="signal-shortcut-help__close"
              onClick={handleClose}
              // Focus lands here, not on the switch above it, so a stray
              // Space on opening cannot turn the shortcuts off.
              autoFocus
            >
              {copy.close}
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
  const label = signalsCopy[useLocale()].shortcuts.hint;

  return (
    <button
      type="button"
      className="signal-shortcut-hint quiet-button"
      onClick={onOpen}
      aria-haspopup="dialog"
    >
      {label} <kbd>?</kbd>
    </button>
  );
}
