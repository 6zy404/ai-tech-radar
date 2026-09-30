import { describe, expect, it } from "vitest";

import {
  countExportableMarks,
  decodeReadingCode,
  describeReadingImport,
  encodeReadingCode,
  mergeReadingCode
} from "./reading-transfer";
import { toVisitKey } from "./visit-state";

const published = ["tech-a", "tech-b", "tech-c", "tech-d"];
const none = { savedIds: [], readIds: [] };

function importCode(
  code: string,
  local: { savedIds: string[]; readIds: string[] } = none,
  publishedIds: string[] = published
) {
  const decoded = decodeReadingCode(code);

  if (!decoded) {
    throw new Error(`code did not decode: ${code}`);
  }

  return mergeReadingCode(decoded, publishedIds, local);
}

describe("encodeReadingCode", () => {
  it("pins the key function, so codes exported today still import later", () => {
    expect(toVisitKey("tech-a")).toBe("x5mdbj");
    expect(
      encodeReadingCode(
        { savedIds: ["tech-a"], readIds: ["tech-b"] },
        published
      )
    ).toBe("rm1:s=x5mdbj;r=xflz0i");
  });

  it("keeps saved order and drops ids that are no longer published", () => {
    const code = encodeReadingCode(
      { savedIds: ["tech-c", "archived", "tech-a", "tech-c"], readIds: [] },
      published
    );

    expect(code).toBe(
      `rm1:s=${toVisitKey("tech-c")}.${toVisitKey("tech-a")};r=`
    );
  });

  it("counts only the marks a code would carry", () => {
    expect(
      countExportableMarks(
        { savedIds: ["tech-a", "gone"], readIds: ["tech-a", "tech-b"] },
        published
      )
    ).toBe(3);
    expect(
      countExportableMarks({ savedIds: ["gone"], readIds: [] }, published)
    ).toBe(0);
  });
});

describe("decodeReadingCode", () => {
  it("round-trips an exported code", () => {
    const marks = { savedIds: ["tech-b", "tech-a"], readIds: ["tech-c"] };
    const result = importCode(encodeReadingCode(marks, published));

    expect(result.next).toEqual(marks);
    expect(result.ignored).toBe(0);
  });

  it("survives what copying does to text: spaces, line breaks, case, full-width punctuation", () => {
    const code = encodeReadingCode(
      { savedIds: ["tech-a", "tech-b"], readIds: ["tech-c"] },
      published
    );
    const mangled = `  ${code.toUpperCase().replace(";", "；\n").replace(":", "：")} `;

    expect(importCode(mangled).next).toEqual({
      savedIds: ["tech-a", "tech-b"],
      readIds: ["tech-c"]
    });
  });

  it("accepts sections in either order and an empty section", () => {
    const code = `rm1:r=${toVisitKey("tech-a")};s=`;

    expect(importCode(code).next).toEqual({
      savedIds: [],
      readIds: ["tech-a"]
    });
  });

  it.each([
    ["", "empty"],
    ["hello", "no prefix"],
    ["technology-a,technology-b", "a 关注码"],
    ["rm1:", "prefix only"],
    ["rm1:s=;r=", "no keys"],
    ["rm1:x=abc", "unknown section"]
  ])("rejects %j (%s)", (raw) => {
    expect(decodeReadingCode(raw)).toBeNull();
  });

  it("counts malformed tokens instead of rejecting the whole code", () => {
    const decoded = decodeReadingCode(
      `rm1:s=${toVisitKey("tech-a")}.not_a_key.toolongkey`
    );

    expect(decoded).toEqual({
      savedKeys: [toVisitKey("tech-a")],
      readKeys: [],
      malformedCount: 2
    });
  });
});

describe("mergeReadingCode", () => {
  it("keeps local marks and their order, appending new ones", () => {
    const result = importCode(
      encodeReadingCode(
        { savedIds: ["tech-c", "tech-a"], readIds: ["tech-b"] },
        published
      ),
      { savedIds: ["tech-a", "tech-d"], readIds: ["tech-d"] }
    );

    expect(result.next).toEqual({
      savedIds: ["tech-a", "tech-d", "tech-c"],
      readIds: ["tech-d", "tech-b"]
    });
    expect(result.addedSaved).toBe(1);
    expect(result.addedRead).toBe(1);
    expect(result.alreadyPresent).toBe(1);
  });

  it("does not mutate the local marks", () => {
    const local = { savedIds: ["tech-a"], readIds: [] };

    importCode(
      encodeReadingCode({ savedIds: ["tech-b"], readIds: [] }, published),
      local
    );

    expect(local).toEqual({ savedIds: ["tech-a"], readIds: [] });
  });

  it("ignores keys for signals this page does not have", () => {
    const code = encodeReadingCode(
      { savedIds: ["tech-a", "only-there"], readIds: ["only-there"] },
      [...published, "only-there"]
    );
    const result = importCode(code);

    expect(result.next).toEqual({ savedIds: ["tech-a"], readIds: [] });
    expect(result.ignored).toBe(2);
  });

  it("ignores a key that two published signals share rather than guessing", () => {
    // Found by brute force: the two ids hash to the same 32-bit key.
    expect(toVisitKey("sig-89582")).toBe(toVisitKey("sig-580580"));

    const result = importCode(
      `rm1:s=${toVisitKey("sig-89582")}.${toVisitKey("tech-a")}`,
      none,
      [...published, "sig-89582", "sig-580580"]
    );

    expect(result.next.savedIds).toEqual(["tech-a"]);
    expect(result.ignored).toBe(1);
  });

  it("counts a key repeated in the code once", () => {
    const key = toVisitKey("tech-a");
    const result = importCode(`rm1:s=${key}.${key}`);

    expect(result.next.savedIds).toEqual(["tech-a"]);
    expect(result.addedSaved).toBe(1);
    expect(result.ignored).toBe(0);
  });
});

describe("describeReadingImport", () => {
  it("reports added, already present and ignored marks", () => {
    expect(
      describeReadingImport({
        next: none,
        addedSaved: 3,
        addedRead: 5,
        alreadyPresent: 2,
        ignored: 1
      })
    ).toBe(
      "导入 8 条（稍后读 3 · 已读 5），2 条本机已有，忽略 1 条无法识别或已下线的信号。"
    );
  });

  it("says so when nothing was new", () => {
    expect(
      describeReadingImport({
        next: none,
        addedSaved: 0,
        addedRead: 0,
        alreadyPresent: 4,
        ignored: 0
      })
    ).toBe("没有新的标记，4 条本机已有。");
  });
});
