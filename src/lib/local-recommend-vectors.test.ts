import { describe, expect, it } from "vitest";

import { etagMatches } from "@/lib/local-recommend-vectors";

// The recommendation data file's 304. Cloudflare serves the strong tag the
// route sends as `W/"…"`, so the weak form is the one browsers send back.
describe("etagMatches", () => {
  const etag = '"5eaaeefdddcda463bb9fea48"';

  it("matches the strong tag", () => {
    expect(etagMatches('"5eaaeefdddcda463bb9fea48"', etag)).toBe(true);
  });

  it("matches the weak tag a proxy turned it into", () => {
    expect(etagMatches('W/"5eaaeefdddcda463bb9fea48"', etag)).toBe(true);
  });

  it("matches any tag in a list, with or without spaces", () => {
    expect(etagMatches('"older", W/"5eaaeefdddcda463bb9fea48"', etag)).toBe(
      true
    );
    expect(etagMatches('"older",W/"5eaaeefdddcda463bb9fea48"', etag)).toBe(
      true
    );
  });

  it("matches `*`", () => {
    expect(etagMatches("*", etag)).toBe(true);
  });

  it("does not match another tag, an empty header or no header", () => {
    expect(etagMatches('W/"0000aaaa"', etag)).toBe(false);
    expect(etagMatches('"older", "newer"', etag)).toBe(false);
    expect(etagMatches("", etag)).toBe(false);
    expect(etagMatches(null, etag)).toBe(false);
  });

  it("does not treat a lower-case w/ as the weak prefix", () => {
    // RFC 9110: the weak indicator is case-sensitive.
    expect(etagMatches('w/"5eaaeefdddcda463bb9fea48"', etag)).toBe(false);
  });
});
