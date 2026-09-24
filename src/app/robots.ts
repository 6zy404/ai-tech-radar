import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-metadata";

// The public build has no workspace routes to hide (they are removed before
// `next build`), so this only has to point crawlers at the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${getSiteUrl()}/sitemap.xml`
  };
}
