import Link from "next/link";

export interface RelationshipGraphNode {
  title: string;
  href: string;
  kind: "technology" | "skill" | "knowledge";
  /** Localized relation-type label (e.g. "建立在"), shown as a hover tooltip. */
  relationLabel?: string;
  /** Short Chinese explanation of why the two items are connected. */
  note?: string;
}

interface RelationshipGraphProps {
  centerTitle: string;
  nodes: RelationshipGraphNode[];
  /** Outer section chrome class, so the graph fits the host page's card language. */
  sectionClassName?: string;
  heading?: string;
  hint?: string;
}

// Neighbours are grouped by kind rather than placed on a ring. The ring put
// every node on a fixed radius that did not grow with the node count, while
// each node box was sized by its own label, so the layout collapsed as soon as
// an item had enough relations: measured 2026-08-04 on the published signals,
// 6 overlapping node pairs at 1440px with 11 relations (and a node painted 25px
// above the canvas, over the hint text), and at 390px every signal page tested
// overlapped — including one with only 5 relations. Grouping is 0/0 at both
// widths and needs no hover, which a phone does not have.
//
// This also retires the ring's trigonometry, and with it the cross-engine
// hydration hazard recorded on 2026-08-03: there are no computed coordinates
// in the markup left to disagree about.
const kindOrder = ["technology", "skill", "knowledge"] as const;

const kindLabel: Record<RelationshipGraphNode["kind"], string> = {
  technology: "技术",
  skill: "技能",
  knowledge: "知识"
};

export function RelationshipGraph({
  centerTitle,
  nodes,
  sectionClassName = "user-article-section",
  heading = "在关系网络中的位置",
  hint = "当前条目与相邻技术、技能和背景知识的连接，点击节点可继续探索。"
}: RelationshipGraphProps) {
  if (nodes.length === 0) {
    return null;
  }

  const groups = kindOrder
    .map((kind) => ({
      kind,
      label: kindLabel[kind],
      items: nodes.filter((node) => node.kind === kind)
    }))
    .filter((group) => group.items.length > 0);

  return (
    <section className={`tech-graph ${sectionClassName}`.trim()}>
      <p className="technology-detail-section__eyebrow">关系网络</p>
      <h2>{heading}</h2>
      <p className="tech-graph__hint">{hint}</p>
      <div className="tech-graph__map">
        {/* A <div>, not a <p>: every host section styles its own paragraphs
            with a `container p` rule that outranks a lone class (see the
            __hint comment below), and here that would repaint the centre
            banner's text on top of its accent fill. */}
        <div className="tech-graph__node tech-graph__node--center">
          {centerTitle}
        </div>
        {groups.map((group) => (
          <div className="tech-graph__group" key={group.kind}>
            {/* The group states the kind, so the chips no longer repeat it —
                on public pages the per-chip label was the only thing carrying
                the kind colour, because `.dossier .tech-graph__node` overrides
                the per-kind border. The colour moves here with it. */}
            <div
              className={`tech-graph__group-label tech-graph__group-label--${group.kind}`}
            >
              {group.label} · {group.items.length}
            </div>
            <ul className="tech-graph__group-list">
              {group.items.map((node) => (
                <li key={node.href}>
                  <Link
                    href={node.href}
                    className={`tech-graph__node tech-graph__node--${node.kind}`}
                    title={
                      node.relationLabel
                        ? node.note
                          ? `${node.relationLabel}：${node.note}`
                          : node.relationLabel
                        : undefined
                    }
                  >
                    {node.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
