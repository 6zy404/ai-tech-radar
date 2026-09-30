import { describe, expect, it } from "vitest";

import { withTagFollowed } from "./followed-tags";

describe("withTagFollowed", () => {
  it("appends a newly followed tag at the end", () => {
    expect(withTagFollowed(["tag-a"], "tag-b", true)).toEqual([
      "tag-a",
      "tag-b"
    ]);
  });

  it("leaves an already followed tag where it is", () => {
    expect(withTagFollowed(["tag-a", "tag-b"], "tag-a", true)).toEqual([
      "tag-a",
      "tag-b"
    ]);
  });

  it("removes an unfollowed tag", () => {
    expect(withTagFollowed(["tag-a", "tag-b"], "tag-a", false)).toEqual([
      "tag-b"
    ]);
  });

  it("leaves the set alone when unfollowing a tag that is not followed", () => {
    expect(withTagFollowed(["tag-a"], "tag-b", false)).toEqual(["tag-a"]);
  });

  it("does not mutate the input list", () => {
    const ids = ["tag-a"];

    withTagFollowed(ids, "tag-b", true);

    expect(ids).toEqual(["tag-a"]);
  });
});
