import { ChineseOnlyNote } from "@/components/chinese-only-note";
import { ContentNetworkGraph } from "@/components/content-network-graph";
import { UserPageShell } from "@/components/user-page-shell";
import { getContentGraph } from "@/lib/content";
import { networkCopy } from "@/lib/i18n/copy/network";
import { localizeContentGraph } from "@/lib/i18n/graph-nodes";
import type { Locale } from "@/lib/i18n/locale";
import { resolveNetworkFocus } from "@/lib/network-focus";
import { buildPageMetadata } from "@/lib/site-metadata";

export function getNetworkPageMetadata(locale: Locale) {
  const copy = networkCopy[locale];

  return buildPageMetadata({
    title: copy.title,
    description: copy.description,
    path: "/network",
    locale
  });
}

export interface NetworkPageProps {
  searchParams: Promise<{ focus?: string | string[] }>;
}

export async function NetworkPage({
  searchParams,
  locale
}: NetworkPageProps & { locale: Locale }) {
  const copy = networkCopy[locale];
  const { focus } = await searchParams;
  const { nodes, edges, nodeLangs } = localizeContentGraph(
    getContentGraph(),
    locale
  );
  // `?focus=<node id>` opens the page with that node selected. An unknown or
  // unpublished id is dropped here, so the page renders exactly as it would
  // without the parameter.
  const initialFocusId = resolveNetworkFocus(focus, nodes);

  return (
    <UserPageShell
      title={copy.title}
      description={copy.description}
      sectionLabel={copy.sectionLabel}
      className="network-page dossier"
    >
      <ChineseOnlyNote locale={locale}>{copy.chineseOnly}</ChineseOnlyNote>
      <ContentNetworkGraph
        nodes={nodes}
        edges={edges}
        initialFocusId={initialFocusId}
        nodeLangs={nodeLangs}
      />
    </UserPageShell>
  );
}
