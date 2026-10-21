import { permanentRedirect } from "next/navigation";

// The English twin of src/app/news/page.tsx.
export const dynamic = "force-dynamic";

export default function NewsPage() {
  // The view moved for good, so the redirect is a 308 (permanent), not the
  // 307 `redirect()` sends: a crawler then drops this address and credits the
  // target (seo-12, 2026-10-21).
  permanentRedirect("/en/technologies?view=news");
}
