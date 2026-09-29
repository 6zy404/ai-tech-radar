"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSignalShortcutPreference } from "@/components/use-signal-shortcut-preference";
import {
  reconcileCurrentSignalId,
  resolveSignalShortcut,
  stepSignalId
} from "@/lib/signal-shortcuts";

export interface ShortcutSignal {
  id: string;
  href: string;
}

interface UseSignalShortcutsOptions {
  /** The signals in the order they are rendered, hidden ones already out. */
  signals: ShortcutSignal[];
  isRead: (technologyId: string) => boolean;
  isSaved: (technologyId: string) => boolean;
  toggleRead: (technologyId: string) => void;
  toggleSaved: (technologyId: string) => void;
  /** False turns every key off, ? included. */
  enabled?: boolean;
}

export interface SignalShortcutsState {
  currentId: string | null;
  isHelpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
  /** Polite live-region text, so a screen reader hears what s / x did. */
  announcement: string;
}

// Marks the title link of each card; the card itself is its closest
// .dossier-technology-card. Kept on the link because that is what receives
// focus, so Enter on it follows the link natively.
const signalLinkSelector = "[data-signal-id]";
const cardSelector = ".dossier-technology-card";
const helpSelector = "[data-signal-shortcut-help]";

function findSignalLink(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `${signalLinkSelector}[data-signal-id="${CSS.escape(id)}"]`
  );
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * j / k / Enter / o / s / x / ? on a signal list. The current card is the
 * one whose title link holds focus, so a screen reader announces the title
 * and Tab continues from there; the card also gets an outline
 * (`isCurrent` on DossierTechnologyCard).
 */
export function useSignalShortcuts({
  signals,
  isRead,
  isSaved,
  toggleRead,
  toggleSaved,
  enabled = true
}: UseSignalShortcutsOptions): SignalShortcutsState {
  const router = useRouter();
  const [singleKeysEnabled] = useSignalShortcutPreference();
  // j / k / o / s / x (and the current-card outline) need both the list to
  // be ready and the reader not to have turned them off; ? needs only the
  // first, so the switch in the overlay stays reachable.
  const cardKeysEnabled = enabled && singleKeysEnabled;
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const focusRequestRef = useRef(false);
  const idsKey = signals.map((signal) => signal.id).join("\n");
  const previousIdsRef = useRef<string[]>([]);

  // Keep the latest values reachable from the one keydown listener without
  // re-binding it on every render.
  const latestRef = useRef({
    signals,
    currentId,
    isHelpOpen,
    singleKeysEnabled,
    isRead,
    isSaved,
    toggleRead,
    toggleSaved
  });
  latestRef.current = {
    signals,
    currentId,
    isHelpOpen,
    singleKeysEnabled,
    isRead,
    isSaved,
    toggleRead,
    toggleSaved
  };

  const moveTo = useCallback((id: string | null) => {
    focusRequestRef.current = id !== null;
    setCurrentId(id);
  }, []);

  // The list changed (a filter, or x with 隐藏已读 on): keep the reader's
  // place on the neighbouring card instead of losing it.
  useEffect(() => {
    const nextIds = idsKey.length > 0 ? idsKey.split("\n") : [];
    const previousIds = previousIdsRef.current;

    previousIdsRef.current = nextIds;
    setCurrentId((current) => {
      const reconciled = reconcileCurrentSignalId(
        previousIds,
        nextIds,
        current
      );

      if (reconciled !== current && reconciled !== null) {
        const active = document.activeElement;

        // The focused card just unmounted and focus fell back to the body.
        focusRequestRef.current = !active || active === document.body;
      }

      return reconciled;
    });
  }, [idsKey]);

  // Move focus and scroll only after the card has rendered as current.
  useEffect(() => {
    if (!focusRequestRef.current || currentId === null) {
      return;
    }

    focusRequestRef.current = false;
    const link = findSignalLink(currentId);

    if (!link) {
      return;
    }

    link.focus({ preventScroll: true });
    (link.closest(cardSelector) ?? link).scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth"
    });
  }, [currentId]);

  // Tabbing onto a card makes it current too, so j / k carry on from where
  // the reader is. Only keyboard focus counts (:focus-visible): a mouse click
  // on a card's button must not light the card up.
  useEffect(() => {
    if (!cardKeysEnabled) {
      return;
    }

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.closest(helpSelector)) {
        return;
      }

      const card = target.closest(cardSelector);
      const id = card
        ?.querySelector<HTMLElement>(signalLinkSelector)
        ?.getAttribute("data-signal-id");

      if (id && latestRef.current.signals.some((item) => item.id === id)) {
        if (target.matches(":focus-visible")) {
          setCurrentId(id);
        }

        return;
      }

      // Keyboard focus moved somewhere else on the page (the search box,
      // a filter): drop the outline rather than leave a stale one behind.
      if (target.matches(":focus-visible")) {
        setCurrentId(null);
      }
    };

    document.addEventListener("focusin", handleFocusIn);

    return () => document.removeEventListener("focusin", handleFocusIn);
  }, [cardKeysEnabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const latest = latestRef.current;

      // The open dialog owns the keyboard (Esc, Tab). Read from the DOM
      // rather than from state: it is what the reader is looking at.
      if (
        latest.isHelpOpen ||
        document.querySelector(`${helpSelector}[open]`)
      ) {
        return;
      }

      const action = resolveSignalShortcut(
        {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          isComposing: event.isComposing,
          defaultPrevented: event.defaultPrevented,
          target: event.target instanceof Element ? event.target : null
        },
        { singleKeysEnabled: latest.singleKeysEnabled }
      );

      if (action === null) {
        return;
      }

      const ids = latest.signals.map((signal) => signal.id);
      // A current id that has not been reconciled yet is treated as none.
      const current =
        latest.currentId !== null && ids.includes(latest.currentId)
          ? latest.currentId
          : null;

      if (action === "help") {
        event.preventDefault();
        setIsHelpOpen(true);
        return;
      }

      if (action === "next" || action === "previous") {
        if (ids.length === 0) {
          return;
        }

        event.preventDefault();
        moveTo(stepSignalId(ids, current, action));
        return;
      }

      if (current === null) {
        if (ids.length > 0 && action !== "open") {
          setAnnouncement("先按 j 选中一条信号。");
        }

        return;
      }

      event.preventDefault();

      if (action === "open") {
        const signal = latest.signals.find((item) => item.id === current);

        if (signal) {
          router.push(signal.href);
        }

        return;
      }

      if (action === "toggle-saved") {
        const wasSaved = latest.isSaved(current);

        latest.toggleSaved(current);
        setAnnouncement(wasSaved ? "已移出稍后读。" : "已加入稍后读。");
        return;
      }

      const wasRead = latest.isRead(current);

      latest.toggleRead(current);
      setAnnouncement(wasRead ? "已取消已读。" : "已标为已读。");
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, moveTo, router]);

  useEffect(() => {
    if (!enabled) {
      setIsHelpOpen(false);
    }
  }, [enabled]);

  // Turning the keys off (or the list going away) drops the outline too.
  useEffect(() => {
    if (!cardKeysEnabled) {
      setCurrentId(null);
    }
  }, [cardKeysEnabled]);

  const openHelp = useCallback(() => setIsHelpOpen(true), []);
  const closeHelp = useCallback(() => setIsHelpOpen(false), []);

  return { currentId, isHelpOpen, openHelp, closeHelp, announcement };
}
