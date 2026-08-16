/**
 * How much of a digest's editorial summary a *card* may show.
 *
 * The two card surfaces that carry it — the `/digest` archive index and the
 * home page's latest-digest card — passed the whole string through, while every
 * other card on the site is capped: technology cards at 260 characters, the
 * news fast lane and search at 220, the digest's own item cards at 190.
 *
 * That went unnoticed while editorial summaries were short. Measured
 * 2026-08-16 over all 21 published digests: median 323 characters but the last
 * six between 486 and 932, the longest rendering a **499px card** made of one
 * unbroken flattened paragraph. Summaries have been getting longer since they
 * started rendering through `ContentBody` on 2026-08-09, so the gap widens on
 * its own.
 *
 * One value shared by both surfaces, because they are siblings showing the same
 * field and this repo has repeatedly paid for letting such pairs drift apart.
 * The cut itself goes through `compactText`, so it lands on a clause or word
 * boundary rather than mid-word.
 */
export const digestCardSummaryLength = 260;
