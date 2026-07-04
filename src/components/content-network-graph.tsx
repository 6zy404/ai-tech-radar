"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { ContentGraphEdge, ContentGraphNode } from "@/lib/content";
import { getRelationTypeLabel } from "@/lib/technology-localization";

interface ContentNetworkGraphProps {
  nodes: ContentGraphNode[];
  edges: ContentGraphEdge[];
}

interface PositionedNode extends ContentGraphNode {
  x: number;
  y: number;
}

// Coordinate space for the connector <svg>; HTML nodes are placed at the same
// relative positions, so preserveAspectRatio="none" keeps lines and nodes
// aligned regardless of the container's actual pixel aspect ratio.
const VIEW_W = 100;
const VIEW_H = 100;
const LANE_X: Record<ContentGraphNode["kind"], number> = {
  technology: 18,
  skill: 50,
  knowledge: 82
};
const kindOrder: ContentGraphNode["kind"][] = [
  "technology",
  "skill",
  "knowledge"
];

const kindLabel: Record<ContentGraphNode["kind"], string> = {
  technology: "技术",
  skill: "技能",
  knowledge: "知识"
};

function layoutNodes(nodes: ContentGraphNode[]): PositionedNode[] {
  const positioned: PositionedNode[] = [];

  kindOrder.forEach((kind) => {
    const laneNodes = nodes.filter((node) => node.kind === kind);
    const count = laneNodes.length;

    laneNodes.forEach((node, index) => {
      const y = count === 1 ? 50 : 8 + index * (84 / (count - 1));
      positioned.push({ ...node, x: LANE_X[kind], y });
    });
  });

  return positioned;
}

export function ContentNetworkGraph({
  nodes,
  edges
}: ContentNetworkGraphProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const positioned = useMemo(() => layoutNodes(nodes), [nodes]);
  const positionById = useMemo(
    () => new Map(positioned.map((node) => [node.id, node])),
    [positioned]
  );

  const selectedNode = selectedId
    ? (positionById.get(selectedId) ?? null)
    : null;

  const selectedEdges = useMemo(() => {
    if (!selectedId) {
      return [];
    }

    return edges.filter(
      (edge) => edge.sourceId === selectedId || edge.targetId === selectedId
    );
  }, [edges, selectedId]);

  const connectedIds = useMemo(() => {
    const set = new Set<string>();

    selectedEdges.forEach((edge) => {
      set.add(edge.sourceId === selectedId ? edge.targetId : edge.sourceId);
    });

    return set;
  }, [selectedEdges, selectedId]);

  const connections = useMemo(() => {
    if (!selectedId) {
      return [];
    }

    return selectedEdges
      .map((edge) => {
        const otherId =
          edge.sourceId === selectedId ? edge.targetId : edge.sourceId;
        const otherNode = positionById.get(otherId);

        if (!otherNode) {
          return undefined;
        }

        return {
          id: edge.id,
          node: otherNode,
          relationType: edge.relationType
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.node.title.localeCompare(b.node.title, "zh"));
  }, [selectedEdges, selectedId, positionById]);

  const handleNodeClick = (id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  };

  return (
    <div className="content-network">
      <div className="content-network__canvas">
        <svg
          className="content-network__lines"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {edges.map((edge) => {
            const source = positionById.get(edge.sourceId);
            const target = positionById.get(edge.targetId);

            if (!source || !target) {
              return null;
            }

            const isActive =
              selectedId !== null &&
              (edge.sourceId === selectedId || edge.targetId === selectedId);
            const edgeClassName = `content-network__edge${
              isActive ? " content-network__edge--active" : ""
            }`;

            if (source.kind === target.kind) {
              const controlX = source.x - 9;
              const controlY = (source.y + target.y) / 2;

              return (
                <path
                  key={edge.id}
                  d={`M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`}
                  className={edgeClassName}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
              );
            }

            return (
              <line
                key={edge.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className={edgeClassName}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {positioned.map((node) => {
          const isSelected = node.id === selectedId;
          const isDimmed =
            selectedId !== null && !isSelected && !connectedIds.has(node.id);
          const className = [
            "tech-graph__node",
            `tech-graph__node--${node.kind}`,
            "content-network__node",
            isSelected ? "content-network__node--selected" : "",
            isDimmed ? "content-network__node--dim" : ""
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={node.id}
              type="button"
              className={className}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              onClick={() => handleNodeClick(node.id)}
              aria-pressed={isSelected}
            >
              <span className="tech-graph__node-kind">
                {kindLabel[node.kind]}
              </span>
              {node.title}
            </button>
          );
        })}
      </div>

      <aside className="content-network__panel" aria-live="polite">
        {selectedNode ? (
          <>
            <p className="technology-detail-section__eyebrow">
              {kindLabel[selectedNode.kind]}
            </p>
            <h3>{selectedNode.title}</h3>
            <Link className="action-link" href={selectedNode.href}>
              查看详情
            </Link>
            {connections.length > 0 ? (
              <ul className="content-network__panel-list">
                {connections.map((connection) => (
                  <li key={connection.id}>
                    <span className="user-related-section__relation">
                      {getRelationTypeLabel(connection.relationType, "zh")}
                    </span>
                    <Link href={connection.node.href}>
                      {connection.node.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="content-network__panel-empty">暂无已记录的连接。</p>
            )}
          </>
        ) : (
          <>
            <p className="content-network__panel-hint">
              点击任意节点，查看它的直接连接；再次点击可取消选中。
            </p>
            <ul className="content-network__legend">
              <li className="content-network__legend-item content-network__legend-item--technology">
                技术
              </li>
              <li className="content-network__legend-item content-network__legend-item--skill">
                技能
              </li>
              <li className="content-network__legend-item content-network__legend-item--knowledge">
                知识
              </li>
            </ul>
            <p className="content-network__panel-count">
              {nodes.length} 个节点 · {edges.length} 条连接
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
