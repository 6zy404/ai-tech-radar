import { describe, expect, it } from "vitest";

import { applyReadFilter } from "@/lib/reading-state";
import {
  isEditableTarget,
  isInteractiveTarget,
  reconcileCurrentSignalId,
  resolveSignalShortcut,
  stepSignalId,
  type ShortcutKeyEventLike,
  type ShortcutTargetLike
} from "@/lib/signal-shortcuts";

function element(
  tagName: string,
  extra: { role?: string; isContentEditable?: boolean } = {}
): ShortcutTargetLike {
  return {
    tagName,
    isContentEditable: extra.isContentEditable ?? false,
    getAttribute: (name) => (name === "role" ? (extra.role ?? null) : null)
  };
}

function press(
  key: string,
  overrides: Partial<ShortcutKeyEventLike> = {}
): ShortcutKeyEventLike {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    defaultPrevented: false,
    target: element("BODY"),
    ...overrides
  };
}

describe("resolveSignalShortcut", () => {
  it("maps the documented keys", () => {
    expect(resolveSignalShortcut(press("j"))).toBe("next");
    expect(resolveSignalShortcut(press("k"))).toBe("previous");
    expect(resolveSignalShortcut(press("o"))).toBe("open");
    expect(resolveSignalShortcut(press("Enter"))).toBe("open");
    expect(resolveSignalShortcut(press("s"))).toBe("toggle-saved");
    expect(resolveSignalShortcut(press("x"))).toBe("toggle-read");
    expect(resolveSignalShortcut(press("?"))).toBe("help");
    expect(resolveSignalShortcut(press("？"))).toBe("help");
  });

  it("ignores keys it does not own, including upper-case letters", () => {
    expect(resolveSignalShortcut(press("a"))).toBeNull();
    expect(resolveSignalShortcut(press("J"))).toBeNull();
    expect(resolveSignalShortcut(press(" "))).toBeNull();
    expect(resolveSignalShortcut(press("Escape"))).toBeNull();
  });

  it("never fires inside a text field", () => {
    for (const target of [
      element("INPUT"),
      element("TEXTAREA"),
      element("SELECT"),
      element("DIV", { isContentEditable: true }),
      element("DIV", { role: "textbox" })
    ]) {
      expect(resolveSignalShortcut(press("j", { target }))).toBeNull();
      expect(resolveSignalShortcut(press("x", { target }))).toBeNull();
      expect(resolveSignalShortcut(press("?", { target }))).toBeNull();
    }
  });

  it("never fires with Ctrl, Meta or Alt held", () => {
    expect(resolveSignalShortcut(press("j", { ctrlKey: true }))).toBeNull();
    expect(resolveSignalShortcut(press("s", { metaKey: true }))).toBeNull();
    expect(resolveSignalShortcut(press("k", { altKey: true }))).toBeNull();
    expect(resolveSignalShortcut(press("Enter", { ctrlKey: true }))).toBeNull();
  });

  it("never fires during input-method composition or after another handler", () => {
    expect(resolveSignalShortcut(press("j", { isComposing: true }))).toBeNull();
    expect(
      resolveSignalShortcut(press("j", { defaultPrevented: true }))
    ).toBeNull();
  });

  it("leaves Enter to links and buttons, but not letter keys", () => {
    expect(
      resolveSignalShortcut(press("Enter", { target: element("A") }))
    ).toBeNull();
    expect(
      resolveSignalShortcut(press("Enter", { target: element("BUTTON") }))
    ).toBeNull();
    expect(
      resolveSignalShortcut(
        press("Enter", { target: element("DIV", { role: "button" }) })
      )
    ).toBeNull();
    expect(resolveSignalShortcut(press("j", { target: element("A") }))).toBe(
      "next"
    );
    expect(
      resolveSignalShortcut(press("x", { target: element("BUTTON") }))
    ).toBe("toggle-read");
  });

  it("treats a missing target as the page body", () => {
    expect(resolveSignalShortcut(press("j", { target: null }))).toBe("next");
  });
});

describe("isEditableTarget / isInteractiveTarget", () => {
  it("separates text fields from other controls", () => {
    expect(isEditableTarget(element("INPUT"))).toBe(true);
    expect(isEditableTarget(element("BUTTON"))).toBe(false);
    expect(isInteractiveTarget(element("BUTTON"))).toBe(true);
    expect(isInteractiveTarget(element("DIV"))).toBe(false);
    expect(isInteractiveTarget(null)).toBe(false);
  });
});

describe("stepSignalId", () => {
  const ids = ["a", "b", "c"];

  it("starts at the first card when nothing is current", () => {
    expect(stepSignalId(ids, null, "next")).toBe("a");
    expect(stepSignalId(ids, null, "previous")).toBe("a");
    expect(stepSignalId(ids, "gone", "next")).toBe("a");
  });

  it("moves one card at a time", () => {
    expect(stepSignalId(ids, "a", "next")).toBe("b");
    expect(stepSignalId(ids, "c", "previous")).toBe("b");
  });

  it("stays put at either end instead of wrapping", () => {
    expect(stepSignalId(ids, "c", "next")).toBe("c");
    expect(stepSignalId(ids, "a", "previous")).toBe("a");
  });

  it("returns null for an empty list", () => {
    expect(stepSignalId([], null, "next")).toBeNull();
    expect(stepSignalId([], "a", "previous")).toBeNull();
  });

  it("skips read cards that 隐藏已读 removed from the list", () => {
    const technologies = ["a", "b", "c", "d"].map((id) => ({ id }));
    const shownIds = applyReadFilter(technologies, ["b", "c"], true).map(
      (item) => item.id
    );

    expect(stepSignalId(shownIds, "a", "next")).toBe("d");
    expect(stepSignalId(shownIds, "d", "previous")).toBe("a");
  });
});

describe("reconcileCurrentSignalId", () => {
  it("keeps the current card while it is still shown", () => {
    expect(reconcileCurrentSignalId(["a", "b"], ["b", "a"], "a")).toBe("a");
    expect(reconcileCurrentSignalId(["a"], ["a"], null)).toBeNull();
  });

  it("moves to the next shown card when the current one is hidden", () => {
    expect(reconcileCurrentSignalId(["a", "b", "c"], ["a", "c"], "b")).toBe(
      "c"
    );
    expect(
      reconcileCurrentSignalId(["a", "b", "c", "d"], ["a", "d"], "b")
    ).toBe("d");
  });

  it("falls back to the previous card at the end of the list", () => {
    expect(reconcileCurrentSignalId(["a", "b", "c"], ["a", "b"], "c")).toBe(
      "b"
    );
  });

  it("clears when nothing is left or the card was never in the list", () => {
    expect(reconcileCurrentSignalId(["a"], [], "a")).toBeNull();
    expect(reconcileCurrentSignalId(["a"], ["b"], "z")).toBeNull();
  });
});
