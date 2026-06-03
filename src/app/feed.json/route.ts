import { renderDigestJsonFeed } from "@/lib/digest-delivery";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(renderDigestJsonFeed(), {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
