// Keyboard shortcuts for the signal lists on /technologies (精选 / 我关注的 /
// 稍后读). Everything here is pure so the rules can be tested without a DOM:
// which key does what, when a key must be left alone, and where the "current
// card" goes when the reader moves or the list changes under it.

export type SignalShortcutAction =
  "next" | "previous" | "open" | "toggle-saved" | "toggle-read" | "help";

/** The minimal shape of a DOM element the guards below look at. */
export interface ShortcutTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}

/** The minimal shape of a KeyboardEvent the resolver looks at. */
export interface ShortcutKeyEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
  target: ShortcutTargetLike | null;
}

const editableTagNames = new Set(["INPUT", "TEXTAREA", "SELECT"]);

// Elements whose own Enter / Space already mean something. Enter is left to
// them, so a focused link or button behaves exactly as it does without this
// feature.
const interactiveTagNames = new Set([
  "A",
  "BUTTON",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "SUMMARY"
]);

const interactiveRoles = new Set([
  "button",
  "link",
  "checkbox",
  "switch",
  "menuitem",
  "option",
  "tab",
  "textbox",
  "combobox",
  "searchbox"
]);

/** True when typing into the target should produce text, not a shortcut. */
export function isEditableTarget(target: ShortcutTargetLike | null): boolean {
  if (!target) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName?.toUpperCase() ?? "";

  if (editableTagNames.has(tagName)) {
    return true;
  }

  const role = target.getAttribute?.("role");

  return role === "textbox" || role === "combobox" || role === "searchbox";
}

/** True when the target already handles Enter on its own. */
export function isInteractiveTarget(
  target: ShortcutTargetLike | null
): boolean {
  if (!target) {
    return false;
  }

  if (isEditableTarget(target)) {
    return true;
  }

  const tagName = target.tagName?.toUpperCase() ?? "";

  if (interactiveTagNames.has(tagName)) {
    return true;
  }

  const role = target.getAttribute?.("role");

  return role ? interactiveRoles.has(role) : false;
}

const letterActions: Record<string, SignalShortcutAction> = {
  j: "next",
  k: "previous",
  o: "open",
  s: "toggle-saved",
  x: "toggle-read",
  "?": "help",
  // A Chinese input method in Chinese mode types the full-width mark.
  "？": "help"
};

/**
 * Which shortcut a key press means, or null when the page must not react.
 *
 * Left alone: any press with Ctrl / Meta / Alt (browser and screen-reader
 * chords), input-method composition, anything typed into a text field, a
 * press another handler already consumed, and upper-case letters (Shift+J is
 * not j). Enter counts as "open" only when focus is not on something that
 * handles Enter itself — on the card's title link the browser follows the
 * link, which is the same destination.
 */
export function resolveSignalShortcut(
  event: ShortcutKeyEventLike
): SignalShortcutAction | null {
  if (event.defaultPrevented || event.isComposing) {
    return null;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }

  if (isEditableTarget(event.target)) {
    return null;
  }

  if (event.key === "Enter") {
    return isInteractiveTarget(event.target) ? null : "open";
  }

  return letterActions[event.key] ?? null;
}

/**
 * The card j / k lands on. With no current card, both keys start at the
 * first one. At either end the current card stays put — no wrap-around, so
 * holding j never throws the reader back to the top.
 */
export function stepSignalId(
  ids: string[],
  currentId: string | null,
  direction: "next" | "previous"
): string | null {
  if (ids.length === 0) {
    return null;
  }

  const index = currentId === null ? -1 : ids.indexOf(currentId);

  if (index === -1) {
    return ids[0];
  }

  const nextIndex =
    direction === "next"
      ? Math.min(index + 1, ids.length - 1)
      : Math.max(index - 1, 0);

  return ids[nextIndex];
}

/**
 * Where the current card goes when the rendered list changes. Marking the
 * current card read while 隐藏已读 is on removes it from the list; the
 * reader should land on the card that took its place (the next one still
 * shown, else the previous one) rather than lose their position.
 */
export function reconcileCurrentSignalId(
  previousIds: string[],
  nextIds: string[],
  currentId: string | null
): string | null {
  if (currentId === null || nextIds.includes(currentId)) {
    return currentId;
  }

  const previousIndex = previousIds.indexOf(currentId);

  if (previousIndex === -1) {
    return null;
  }

  const shown = new Set(nextIds);

  for (let index = previousIndex + 1; index < previousIds.length; index += 1) {
    if (shown.has(previousIds[index])) {
      return previousIds[index];
    }
  }

  for (let index = previousIndex - 1; index >= 0; index -= 1) {
    if (shown.has(previousIds[index])) {
      return previousIds[index];
    }
  }

  return null;
}
