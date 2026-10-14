import Link from "next/link";

import { topicsCopy } from "@/lib/i18n/copy/topics";
import { localePath, type Locale } from "@/lib/i18n/locale";
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

interface TopicMiniGraphProps {
  graph: TopicGraphData;
  topicName: string;
  /** `lang` per node id whose title is not in the page's language. */
  nodeLangs?: Record<string, string>;
  locale?: Locale;
}

/**
 * 话题页的小关系图。服务端组件：布局在服务端跑完一次（`layoutTopicGraph`，
 * 与 /network 同一套力导），不发任何客户端 JS，不做动画。节点、点的颜色沿用
 * /network 的类名；本话题的条目是实心点，话题外的邻居是空心圈。
 *
 * 图本身 aria-hidden：同一页下方的三组列表与「图谱关联」已经把每一个节点
 * 用文字列出来了，图只多出「谁和谁连着」的形状。节点链接因此也移出 Tab 顺序。
 */
export function TopicMiniGraph({
  graph,
  topicName,
  nodeLangs = {},
  locale = "zh"
}: TopicMiniGraphProps) {
  if (graph.nodes.length < 2 || graph.edges.length === 0) {
    return null;
  }

  const copy = topicsCopy[locale].graph;

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
        <h2>{copy.heading}</h2>
        <span>{copy.counts(graph.nodes.length, graph.edges.length)}</span>
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
                  <title>
                    {getRelationTypeLabel(edge.relationType, "zh", locale)}
                  </title>
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
                title={`${copy.kinds[node.kind]} · ${node.title}`}
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
                <span className="topic-graph__label" lang={nodeLangs[node.id]}>
                  {node.title}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="topic-graph__legend">
          {/* <div>, not <p>: `.user-shell p` pins paragraphs to body size. */}
          <div className="topic-graph__note">
            {copy.note(
              topicName,
              graph.topicNodeTotal,
              shownTopicCount,
              graph.neighborTotal,
              shownNeighborCount
            )}
          </div>
          <ul className="topic-graph__key">
            <li>
              <span className="topic-graph__swatch topic-graph__swatch--inside" />
              {copy.inside}
            </li>
            <li>
              <span className="topic-graph__swatch topic-graph__swatch--outside" />
              {copy.outside}
            </li>
          </ul>
          <div className="topic-graph__key-heading">{copy.relationTypes}</div>
          <ul className="topic-graph__key">
            {families.map((family) => (
              <li key={family}>
                <span
                  className={`topic-graph__line topic-graph__line--${family}`}
                />
                {relationFamilyTypes[family]
                  .map((type) => getRelationTypeLabel(type, "zh", locale))
                  .join(" · ")}
              </li>
            ))}
          </ul>
          {hub ? (
            <Link
              className="action-link"
              href={localePath(locale, buildNetworkFocusHref(hub.id))}
            >
              {copy.viewInNetwork}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
