import { renderTopicRssXml } from "@/lib/topic-feed";

export const dynamic = "force-dynamic";

interface TopicFeedRouteContext {
  params: Promise<{ tagId: string }>;
}

export async function GET(_request: Request, context: TopicFeedRouteContext) {
  const { tagId } = await context.params;
  const xml = renderTopicRssXml(tagId);

  if (!xml) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
