import { describe, expect, it } from "vitest";

import { topicTags } from "@/data/tags";
import { englishTopicNames, localizeTag } from "@/lib/i18n/topic-names";

describe("englishTopicNames", () => {
  it("names every topic tag in English", () => {
    const missing = topicTags
      .map((tag) => tag.id)
      .filter((id) => !englishTopicNames[id]);

    expect(missing).toEqual([]);
  });

  it("has no entry for a tag that does not exist", () => {
    const ids = new Set(topicTags.map((tag) => tag.id));

    expect(Object.keys(englishTopicNames).filter((id) => !ids.has(id))).toEqual(
      []
    );
  });

  it("returns the Chinese tag untouched for the Chinese interface", () => {
    const tag = topicTags[0];

    expect(localizeTag(tag, "zh")).toBe(tag);
    expect(localizeTag(tag, "en").name).toBe(englishTopicNames[tag.id].name);
  });
});
