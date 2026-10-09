import { describe, expect, it } from "vitest";

import { isDefacementTitle } from "@/lib/defacement-title";

describe("isDefacementTitle", () => {
  it.each([
    // The real 2026-10-08 item from the 量子位 feed.
    "hacked by trenggalek6etar",
    "Hacked By Mr.X",
    "HaCkEd   By  Mr.X | Indonesian Cyber Army",
    "~ Hacked_By ~ Sh4d0w",
    "[Hacked-By] GhostSec",
    "hackedby xyz",
    "h4ck3d by zero",
    "Defaced by GhostSec",
    "Owned By TurkHackTeam",
    "pwned by 0x1337",
    "Di Hack Oleh Garuda Security",
    "dihack oleh anonymous",
    // Full-width letters and an ideographic space, folded by NFKC.
    "ＨＡＣＫＥＤ　ＢＹ　Ｘ",
    // A zero-width space splitting the verb.
    "hac​ked by x"
  ])("matches the signature %j", (title) => {
    expect(isDefacementTitle(title)).toBe(true);
  });

  it.each([
    // Real headlines from the candidate snapshot's git history that contain
    // "by" or an intrusion word.
    "Welcome Inkling by Thinking Machines",
    "Introducing ChatGPT for Teens: Built for learning, backed by protections",
    "sqlite-utils 4.0rc2, mostly written by Claude Fable (for about $149.25)",
    "What We Learned by Reproducing 2,200 papers from ICML",
    "Stampli cuts launch hours by 68% using ChatGPT Work",
    "Recreating a 70-year love story frame by frame",
    "v0.31.1rc0: [Metrics] Expose cached prompt tokens by cache tier (#56318)",
    "Azure Cosmos DB 严重漏洞曝光：一条查询可攻破所有租户数据库",
    // The phrase in the middle of a headline is reporting, not a signature.
    "How the router was hacked by researchers",
    "Exchange servers hacked by state actors, Microsoft says",
    // Opens with the phrase but runs on like a headline.
    "Owned by the community: why open-source model governance keeps winning",
    // The verb without "by", or a word that only starts like one.
    "Pwned Passwords by Troy Hunt passes ten billion records",
    "Hacker News launches a new ranking for AI posts",
    "Hacked: what the breach means for model supply chains",
    "",
    "   "
  ])("leaves %j alone", (title) => {
    expect(isDefacementTitle(title)).toBe(false);
  });

  it("treats a missing title as no match", () => {
    expect(isDefacementTitle(undefined)).toBe(false);
  });
});
