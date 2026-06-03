import { renderDigestRssXml } from "@/lib/digest-delivery";

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(renderDigestRssXml(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
