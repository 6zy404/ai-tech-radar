import {
  getAllTechnologies,
  type ContentGraphData,
  type ContentGraphNode
} from "@/lib/content";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { contentLangAttr } from "@/lib/i18n/text-lang";
import { getTechnologyTitleForLocale } from "@/lib/technology-localization";

export interface LocalizedContentGraph extends ContentGraphData {
  /**
   * `lang` per node id, for titles in another language than the page: on the
   * English site every skill and knowledge title, and signals from Chinese
   * sources. Empty on the Chinese site.
   */
  nodeLangs: Record<string, string>;
}

/**
 * The content graph as the English site shows it: signal titles in the
 * interface language where one exists, every link under /en. On the Chinese
 * site the graph is returned unchanged.
 */
export function localizeContentGraph(
  graph: ContentGraphData,
  locale: Locale
): LocalizedContentGraph {
  if (locale === "zh") {
    return { ...graph, nodeLangs: {} };
  }

  const technologies = new Map(
    getAllTechnologies().map((technology) => [technology.id, technology])
  );
  const nodeLangs: Record<string, string> = {};
  const nodes = graph.nodes.map((node): ContentGraphNode => {
    const technology =
      node.kind === "technology" ? technologies.get(node.id) : undefined;
    const title = technology
      ? getTechnologyTitleForLocale(technology, locale)
      : { text: node.title, language: "zh" as const };
    const lang = contentLangAttr(locale, title.language);

    if (lang) {
      nodeLangs[node.id] = lang;
    }

    return { ...node, title: title.text, href: localePath(locale, node.href) };
  });

  return { nodes, edges: graph.edges, nodeLangs };
}
