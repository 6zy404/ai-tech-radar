import { describe, expect, it } from "vitest";

import { keepListedOption } from "./listed-option";

const listed = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("keepListedOption", () => {
  it("keeps the held option while it is still listed", () => {
    expect(keepListedOption(listed, "b")).toBe("b");
  });

  it("falls back to the first option once the held one leaves the list", () => {
    // The manual-add case: "a" was just added to the digest, so the refreshed
    // list no longer offers it, and the next click must send "b" — the
    // option the browser now shows — not "a" again.
    const afterAdd = listed.filter((option) => option.id !== "a");

    expect(keepListedOption(afterAdd, "a")).toBe("b");
  });

  it("follows the list down to its last option", () => {
    let held = "";
    let remaining = listed;
    const sent: string[] = [];

    // Bounded, so a regression that keeps re-sending one id fails here
    // instead of looping forever.
    for (let i = 0; i < listed.length && remaining.length > 0; i += 1) {
      held = keepListedOption(remaining, held);
      sent.push(held);
      remaining = remaining.filter((option) => option.id !== held);
    }

    expect(sent).toEqual(["a", "b", "c"]);
  });

  it("returns an empty id for an empty list", () => {
    expect(keepListedOption([], "a")).toBe("");
  });
});
