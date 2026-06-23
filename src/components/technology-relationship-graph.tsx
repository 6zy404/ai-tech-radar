import Link from "next/link";

export interface RelationshipGraphNode {
  title: string;
  href: string;
  kind: "technology" | "skill" | "knowledge";
}

interface TechnologyRelationshipGraphProps {
  centerTitle: string;
  nodes: RelationshipGraphNode[];
}

// Coordinate space for the connector <svg>; HTML nodes are placed at the same
// relative positions, so preserveAspectRatio="none" keeps lines and nodes aligned.
const VIEW_W = 100;
const VIEW_H = 64;
const CENTER_X = VIEW_W / 2;
const CENTER_Y = VIEW_H / 2;
const RADIUS_X = 37;
const RADIUS_Y = 26;

const kindLabel: Record<RelationshipGraphNode["kind"], string> = {
  technology: "技术",
  skill: "技能",
  knowledge: "知识"
};

export function TechnologyRelationshipGraph({
  centerTitle,
  nodes
}: TechnologyRelationshipGraphProps) {
  if (nodes.length === 0) {
    return null;
  }

  const positioned = nodes.map((node, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / nodes.length;
    return {
      ...node,
      x: CENTER_X + RADIUS_X * Math.cos(angle),
      y: CENTER_Y + RADIUS_Y * Math.sin(angle)
    };
  });

  return (
    <section className="tech-graph user-article-section">
      <p className="technology-detail-section__eyebrow">关系网络</p>
      <h2>在技术网络中的位置</h2>
      <p className="tech-graph__hint">
        当前技术与相邻技术、技能和背景知识的连接，点击节点可继续探索。
      </p>
      <div className="tech-graph__canvas">
        <svg
          className="tech-graph__lines"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {positioned.map((node) => (
            <line
              key={`${node.href}-line`}
              x1={CENTER_X}
              y1={CENTER_Y}
              x2={node.x}
              y2={node.y}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <span
          className="tech-graph__node tech-graph__node--center"
          style={{
            left: `${(CENTER_X / VIEW_W) * 100}%`,
            top: `${(CENTER_Y / VIEW_H) * 100}%`
          }}
        >
          {centerTitle}
        </span>
        {positioned.map((node) => (
          <Link
            key={node.href}
            href={node.href}
            className={`tech-graph__node tech-graph__node--${node.kind}`}
            style={{
              left: `${(node.x / VIEW_W) * 100}%`,
              top: `${(node.y / VIEW_H) * 100}%`
            }}
          >
            <span className="tech-graph__node-kind">{kindLabel[node.kind]}</span>
            {node.title}
          </Link>
        ))}
      </div>
    </section>
  );
}
