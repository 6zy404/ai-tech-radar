import { renderWeeklyReviewRssXml } from "@/lib/weekly-feed";

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(renderWeeklyReviewRssXml(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
