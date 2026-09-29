import { describe, expect, it } from "vitest";

import { collectRelationTargets } from "@/components/relation-checkbox-item";

describe("collectRelationTargets — requires direction", () => {
  function formWith(entries: [string, string][]): FormData {
    const formData = new FormData();

    for (const [key, value] of entries) {
      formData.append(key, value);
    }

    return formData;
  }

  it("sends incoming only for requires", () => {
    const targets = collectRelationTargets(
      formWith([
        ["skills", "skill-a"],
        ["skills", "skill-b"],
        ["relationType:skill:skill-a", "requires"],
        ["relationDirection:skill:skill-a", "incoming"],
        ["relationType:skill:skill-b", "uses"],
        ["relationDirection:skill:skill-b", "incoming"]
      ]),
      [{ name: "skills", targetType: "skill" }]
    );

    expect(targets).toEqual([
      {
        toId: "skill-a",
        toType: "skill",
        relationType: "requires",
        direction: "incoming"
      },
      { toId: "skill-b", toType: "skill", relationType: "uses" }
    ]);
  });
});
