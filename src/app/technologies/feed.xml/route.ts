import { renderAllSignalsRssXml } from "@/lib/signal-feed";

export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(renderAllSignalsRssXml(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
