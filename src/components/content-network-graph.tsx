"use client";

import Link from "next/link";
import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DossierCategoryChips } from "@/components/dossier-category-chips";
import { DossierSearchInput } from "@/components/dossier-search-input";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import type { ContentGraphEdge, ContentGraphNode } from "@/lib/content";
import {
  clamp,
  easeOutCubic,
  gridLayout,
  interpolateLayout,
  type LayoutPositions,
  PAD,
  settleForceLayout,
  VIEW_SIZE
} from "@/lib/network-layout";
import { getRelationTypeLabel } from "@/lib/technology-localization";

interface ContentNetworkGraphProps {
  nodes: ContentGraphNode[];
  edges: ContentGraphEdge[];
}

interface PositionedNode extends ContentGraphNode {
  x: number;
  y: number;
}

// How long the nodes take to travel from the server-rendered grid to the
// settled layout. The layout maths itself lives in `@/lib/network-layout`.
const UNFOLD_MS = 700;

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

const kindFilterOptions = [
  { value: "", label: "全部类型" },
  ...kindOrder.map((kind) => ({ value: kind, label: kindLabel[kind] }))
];

// A node/edge is dimmed only if it fails every currently-active highlight
// criterion (search, category filter, selection). With two independent
// lenses active at once, this is a union: something visible under either
// lens stays visible, rather than requiring both -- selecting a node with
// no connections matching the current search would otherwise dim the
// entire graph to nothing.
function isDimmedByActiveChecks(checks: boolean[]): boolean {
  return checks.length > 0 && !checks.some(Boolean);
}

export function ContentNetworkGraph({
  nodes,
  edges
}: ContentNetworkGraphProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [positions, setPositions] = useState<LayoutPositions>(() =>
    gridLayout(nodes)
  );
  const draggingIdRef = useRef<string | null>(null);

  const nodeKey = useMemo(
    () => nodes.map((node) => node.id).join("|"),
    [nodes]
  );
  const edgeKey = useMemo(
    () => edges.map((edge) => edge.id).join("|"),
    [edges]
  );

  useEffect(() => {
    // The simulation runs to its end here, unpainted, and only the result is
    // shown. Painting its steps is what made this page convulse — see
    // `@/lib/network-layout`. Safe to use Math.cos/Math.sin: this effect only
    // runs client-side, after hydration has reconciled against the grid.
    const settled = settleForceLayout(nodes, edges);

    // Keeps a node the reader has already picked up where they put it.
    const keepDragged = (next: LayoutPositions, prev: LayoutPositions) => {
      const draggingId = draggingIdRef.current;

      return draggingId && prev[draggingId]
        ? { ...next, [draggingId]: prev[draggingId] }
        : next;
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPositions((prev) => keepDragged(settled, prev));
      return;
    }

    // One straight glide from the server-rendered grid. It is driven by
    // elapsed time, not by a frame count, so a tab that was opened in the
    // background arrives at the settled layout instead of resuming mid-way.
    const from = gridLayout(nodes);
    const startedAt = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const progress = (now - startedAt) / UNFOLD_MS;

      setPositions((prev) =>
        keepDragged(
          interpolateLayout(from, settled, easeOutCubic(progress)),
          prev
        )
      );

      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
    // Layout only needs to restart when the set of nodes/edges actually
    // changes identity, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeKey, edgeKey]);

  const positionedNodes = useMemo<PositionedNode[]>(
    () =>
      nodes.map((node) => ({
        ...node,
        x: positions[node.id]?.x ?? VIEW_SIZE / 2,
        y: positions[node.id]?.y ?? VIEW_SIZE / 2
      })),
    [nodes, positions]
  );

  const positionById = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes]
  );

  const normalizedSearch = searchText.trim().toLowerCase();
  const isFilterActive = normalizedSearch.length > 0 || kindFilter.length > 0;

  const matchesFilter = (node: ContentGraphNode) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      node.title.toLowerCase().includes(normalizedSearch);
    const matchesKind = kindFilter.length === 0 || node.kind === kindFilter;

    return matchesSearch && matchesKind;
  };

  // Nodes render as small dots by default; the full title only appears for
  // a hovered/selected node, or -- since a reader typing a name is
  // explicitly asking to find it -- a search match. Kind-filter alone
  // (with no search text) does not force labels, since a filtered
  // category can still hold a dozen-plus nodes and showing every title at
  // once would recreate the original crowding problem.
  const matchesSearchOnly = (node: ContentGraphNode) =>
    normalizedSearch.length > 0 &&
    node.title.toLowerCase().includes(normalizedSearch);

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

  // Grouped by kind, the way the per-item relationship view on the detail
  // pages groups them. A node can have forty-odd connections; mixed together
  // in title order they read as one undifferentiated column.
  const connectionGroups = useMemo(
    () =>
      kindOrder
        .map((kind) => ({
          kind,
          items: connections.filter(
            (connection) => connection.node.kind === kind
          )
        }))
        .filter((group) => group.items.length > 0),
    [connections]
  );

  const hoveredEdge = useMemo(() => {
    if (!hoveredEdgeId) {
      return null;
    }

    const edge = edges.find((item) => item.id === hoveredEdgeId);
    const source = edge ? positionById.get(edge.sourceId) : undefined;
    const target = edge ? positionById.get(edge.targetId) : undefined;

    if (!edge || !source || !target) {
      return null;
    }

    return {
      relationType: edge.relationType,
      x: (source.x + target.x) / 2,
      y: (source.y + target.y) / 2
    };
  }, [hoveredEdgeId, edges, positionById]);

  const handleNodeClick = (id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  };

  const handlePointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    id: string
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingIdRef.current = id;
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const id = draggingIdRef.current;

    if (!id) {
      return;
    }

    const canvas = event.currentTarget.closest(".content-network__canvas");

    if (!(canvas instanceof HTMLElement)) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = clamp(
      ((event.clientX - rect.left) / rect.width) * VIEW_SIZE,
      PAD,
      VIEW_SIZE - PAD
    );
    const y = clamp(
      ((event.clientY - rect.top) / rect.height) * VIEW_SIZE,
      PAD,
      VIEW_SIZE - PAD
    );

    setPositions((prev) => ({ ...prev, [id]: { x, y } }));
  };

  const handlePointerUp = () => {
    draggingIdRef.current = null;
  };

  const matchedCount = nodes.filter(matchesFilter).length;
  const relationTypes = useMemo(
    () =>
      Array.from(new Set(edges.map((edge) => edge.relationType))).sort((a, b) =>
        getRelationTypeLabel(a, "zh").localeCompare(
          getRelationTypeLabel(b, "zh"),
          "zh"
        )
      ),
    [edges]
  );

  return (
    <div className="content-network">
      <div className="content-network__controls">
        <DossierSearchInput
          value={searchText}
          onChange={setSearchText}
          placeholder="搜索节点标题"
        />
        <DossierCategoryChips
          options={kindFilterOptions}
          active={kindFilter}
          onChange={setKindFilter}
        />
      </div>

      <div className="content-network__body">
        <div className="content-network__canvas">
          <svg
            className="content-network__lines"
            viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
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
              const edgeChecks: boolean[] = [];

              if (isFilterActive) {
                edgeChecks.push(matchesFilter(source) && matchesFilter(target));
              }

              if (selectedId !== null) {
                edgeChecks.push(isActive);
              }

              const isDimmed = isDimmedByActiveChecks(edgeChecks);
              const edgeClassName = [
                "content-network__edge",
                isActive ? "content-network__edge--active" : "",
                isDimmed ? "content-network__edge--dim" : ""
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <g key={edge.id}>
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    className="content-network__edge-hit"
                    vectorEffect="non-scaling-stroke"
                    onPointerEnter={() => setHoveredEdgeId(edge.id)}
                    onPointerLeave={() =>
                      setHoveredEdgeId((current) =>
                        current === edge.id ? null : current
                      )
                    }
                  />
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    className={edgeClassName}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </svg>

          {positionedNodes.map((node) => {
            const isSelected = node.id === selectedId;
            const nodeChecks: boolean[] = [];

            if (isFilterActive) {
              nodeChecks.push(matchesFilter(node));
            }

            if (selectedId !== null) {
              nodeChecks.push(isSelected || connectedIds.has(node.id));
            }

            const isDimmed = isDimmedByActiveChecks(nodeChecks);
            const showLabel =
              isSelected ||
              node.id === hoveredNodeId ||
              matchesSearchOnly(node);
            const className = [
              "content-network__node",
              `content-network__node--${node.kind}`,
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
                onPointerDown={(event) => handlePointerDown(event, node.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerEnter={() => setHoveredNodeId(node.id)}
                onPointerLeave={() =>
                  setHoveredNodeId((current) =>
                    current === node.id ? null : current
                  )
                }
                aria-pressed={isSelected}
                aria-label={node.title}
                title={node.title}
              >
                <span
                  className="content-network__node-dot"
                  aria-hidden="true"
                />
                {showLabel ? (
                  <span
                    className="content-network__node-label"
                    aria-hidden="true"
                  >
                    {node.title}
                  </span>
                ) : null}
              </button>
            );
          })}

          {hoveredEdge ? (
            <div
              className="content-network__edge-label"
              style={{
                left: `${hoveredEdge.x}%`,
                top: `${hoveredEdge.y}%`
              }}
            >
              {getRelationTypeLabel(hoveredEdge.relationType, "zh")}
            </div>
          ) : null}
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
              {connectionGroups.length > 0 ? (
                connectionGroups.map((group) => (
                  <div
                    className="content-network__panel-group"
                    key={group.kind}
                  >
                    {/* A <div>, not a <p>: `.user-shell p` pins paragraphs to
                        body size. Same label as the detail pages' per-item
                        relationship view, so the two read as one family. */}
                    <div
                      className={`tech-graph__group-label tech-graph__group-label--${group.kind}`}
                    >
                      {kindLabel[group.kind]} · {group.items.length}
                    </div>
                    <ul className="content-network__panel-list">
                      {group.items.map((connection) => (
                        <li key={connection.id}>
                          <DossierStampTag>
                            {getRelationTypeLabel(
                              connection.relationType,
                              "zh"
                            )}
                          </DossierStampTag>
                          <Link href={connection.node.href}>
                            {connection.node.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="content-network__panel-empty">
                  暂无已记录的连接。
                </p>
              )}
            </>
          ) : (
            <>
              <p className="content-network__panel-hint">
                节点默认只显示彩色圆点；悬停或搜索可以看到名称。点击任意节点查看它的直接连接，拖动节点可以重新摆放；再次点击节点可取消选中。
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
              {relationTypes.length > 0 ? (
                <>
                  <p className="content-network__legend-heading">关系类型</p>
                  <div className="content-network__relation-legend">
                    {relationTypes.map((relationType) => (
                      <DossierStampTag key={relationType}>
                        {getRelationTypeLabel(relationType, "zh")}
                      </DossierStampTag>
                    ))}
                  </div>
                </>
              ) : null}
              <p className="content-network__panel-count">
                {isFilterActive
                  ? `匹配 ${matchedCount} / ${nodes.length} 个节点`
                  : `${nodes.length} 个节点 · ${edges.length} 条连接`}
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
