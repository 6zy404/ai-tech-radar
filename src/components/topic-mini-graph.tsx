import Link from "next/link";

import { buildNetworkFocusHref } from "@/lib/network-focus";
import { VIEW_SIZE } from "@/lib/network-layout";
import { getRelationTypeLabel } from "@/lib/technology-localization";
import {
  getRelationFamily,
  layoutTopicGraph,
  relationFamilyOrder,
  relationFamilyTypes,
  type TopicGraphData
} from "@/lib/topic-graph";
import type { ContentKind } from "@/types/content";

interface TopicMiniGraphProps {
  graph: TopicGraphData;
  topicName: string;
}

const kindLabels: Record<ContentKind, string> = {
  technology: "技术",
  skill: "技能",
  knowledge: "知识"
};

/**
 * 话题页的小关系图。服务端组件：布局在服务端跑完一次（`layoutTopicGraph`，
 * 与 /network 同一套力导），不发任何客户端 JS，不做动画。节点、点的颜色沿用
 * /network 的类名；本话题的条目是实心点，话题外的邻居是空心圈。
 *
 * 图本身 aria-hidden：同一页下方的三组列表与「图谱关联」已经把每一个节点
 * 用文字列出来了，图只多出「谁和谁连着」的形状。节点链接因此也移出 Tab 顺序。
 */
export function TopicMiniGraph({ graph, topicName }: TopicMiniGraphProps) {
  if (graph.nodes.length < 2 || graph.edges.length === 0) {
    return null;
  }

  const positions = layoutTopicGraph(graph);
  const hub = graph.nodes.find((node) => node.inTopic);
  const shownTopicCount = graph.nodes.filter((node) => node.inTopic).length;
  const shownNeighborCount = graph.nodes.length - shownTopicCount;
  const families = relationFamilyOrder.filter((family) =>
    graph.edges.some((edge) => getRelationFamily(edge.relationType) === family)
  );

  return (
    <section className="topic-hub-section topic-graph">
      <div className="topic-hub-section__heading">
        <h2>话题图谱</h2>
        <span>
          {graph.nodes.length} 个节点 · {graph.edges.length} 条连接
        </span>
      </div>
      <div className="topic-graph__body">
        <div
          className="content-network__canvas topic-graph__canvas"
          aria-hidden="true"
        >
          <svg
            className="content-network__lines"
            viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
            preserveAspectRatio="none"
          >
            {graph.edges.map((edge) => {
              const source = positions[edge.sourceId];
              const target = positions[edge.targetId];

              if (!source || !target) {
                return null;
              }

              return (
                <line
                  key={edge.id}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  className={`topic-graph__edge topic-graph__edge--${getRelationFamily(edge.relationType)}`}
                  vectorEffect="non-scaling-stroke"
                >
                  <title>{getRelationTypeLabel(edge.relationType, "zh")}</title>
                </line>
              );
            })}
          </svg>
          {graph.nodes.map((node) => {
            const point = positions[node.id];

            if (!point) {
              return null;
            }

            return (
              <Link
                key={node.id}
                href={node.href}
                tabIndex={-1}
                title={`${kindLabels[node.kind]} · ${node.title}`}
                className={[
                  "content-network__node",
                  `content-network__node--${node.kind}`,
                  "topic-graph__node",
                  node.inTopic ? "" : "topic-graph__node--outside"
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                <span className="content-network__node-dot" />
                <span className="topic-graph__label">{node.title}</span>
              </Link>
            );
          })}
        </div>

        <div className="topic-graph__legend">
          {/* <div>, not <p>: `.user-shell p` pins paragraphs to body size. */}
          <div className="topic-graph__note">
            {`图中是「${topicName}」${graph.topicNodeTotal} 条内容里彼此联系最多的 ${shownTopicCount} 条`}
            {shownNeighborCount > 0
              ? `，以及话题外 ${graph.neighborTotal} 个直接邻居里与它们联系最多的 ${shownNeighborCount} 个`
              : ""}
            。完整列表在下方。
          </div>
          <ul className="topic-graph__key">
            <li>
              <span className="topic-graph__swatch topic-graph__swatch--inside" />
              本话题的内容
            </li>
            <li>
              <span className="topic-graph__swatch topic-graph__swatch--outside" />
              话题外的邻居
            </li>
          </ul>
          <div className="topic-graph__key-heading">关系类型</div>
          <ul className="topic-graph__key">
            {families.map((family) => (
              <li key={family}>
                <span
                  className={`topic-graph__line topic-graph__line--${family}`}
                />
                {relationFamilyTypes[family]
                  .map((type) => getRelationTypeLabel(type, "zh"))
                  .join(" · ")}
              </li>
            ))}
          </ul>
          {hub ? (
            <Link className="action-link" href={buildNetworkFocusHref(hub.id)}>
              在关系网络中查看 →
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
