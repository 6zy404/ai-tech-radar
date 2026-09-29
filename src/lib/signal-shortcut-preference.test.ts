import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseSingleKeyShortcutsEnabled,
  readSingleKeyShortcutsEnabled,
  signalShortcutPreferenceChangedEventName,
  writeSingleKeyShortcutsEnabled
} from "@/lib/signal-shortcut-preference";

function fakeWindow(storage: Partial<Storage>) {
  const events: Event[] = [];

  return {
    events,
    window: {
      localStorage: storage,
      dispatchEvent: (event: Event) => {
        events.push(event);
        return true;
      }
    }
  };
}

function memoryStorage(): Partial<Storage> {
  const map = new Map<string, string>();

  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key)
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseSingleKeyShortcutsEnabled", () => {
  it("is on unless the stored value says off", () => {
    expect(parseSingleKeyShortcutsEnabled(null)).toBe(true);
    expect(parseSingleKeyShortcutsEnabled("")).toBe(true);
    expect(parseSingleKeyShortcutsEnabled("garbage")).toBe(true);
    expect(parseSingleKeyShortcutsEnabled("1")).toBe(false);
  });
});

describe("read / write", () => {
  it("defaults to on on the server", () => {
    expect(readSingleKeyShortcutsEnabled()).toBe(true);
    expect(() => writeSingleKeyShortcutsEnabled(false)).not.toThrow();
  });

  it("round-trips through storage and announces each change", () => {
    const fake = fakeWindow(memoryStorage());
    vi.stubGlobal("window", fake.window);

    expect(readSingleKeyShortcutsEnabled()).toBe(true);
    writeSingleKeyShortcutsEnabled(false);
    expect(readSingleKeyShortcutsEnabled()).toBe(false);
    writeSingleKeyShortcutsEnabled(true);
    expect(readSingleKeyShortcutsEnabled()).toBe(true);

    expect(fake.events.map((event) => event.type)).toEqual([
      signalShortcutPreferenceChangedEventName,
      signalShortcutPreferenceChangedEventName
    ]);
    expect((fake.events[0] as CustomEvent<boolean>).detail).toBe(false);
  });

  it("survives blocked storage: reads as on, writes still announce", () => {
    const blocked = () => {
      throw new Error("SecurityError");
    };
    const fake = fakeWindow({
      getItem: blocked,
      setItem: blocked,
      removeItem: blocked
    });
    vi.stubGlobal("window", fake.window);

    expect(readSingleKeyShortcutsEnabled()).toBe(true);
    expect(() => writeSingleKeyShortcutsEnabled(false)).not.toThrow();
    // The page still learns the choice through the event's detail.
    expect((fake.events[0] as CustomEvent<boolean>).detail).toBe(false);
  });
});
