// The map behind /pwa/signal-paths.json: published signal → its public page
// path, keyed by the short hash the 新 stamps already use (`toVisitKey`), so
// the long workspace ids never leave the server. The service worker resolves
// the reader's saved signals against it (src/lib/pwa-service-worker.ts).

import { toVisitKey } from "@/lib/visit-state";

export function buildSignalPathMap(
  technologies: ReadonlyArray<{ id: string; slug: string; status?: string }>
): Record<string, string> {
  const paths: Record<string, string> = {};

  for (const technology of technologies) {
    if (technology.status && technology.status !== "published") {
      continue;
    }

    paths[toVisitKey(technology.id)] = `/technologies/${technology.slug}`;
  }

  return paths;
}
