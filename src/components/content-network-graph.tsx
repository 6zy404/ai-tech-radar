"use client";

import Link from "next/link";
import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DossierCategoryChips } from "@/components/dossier-category-chips";
import { DossierSearchInput } from "@/components/dossier-search-input";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import type { ContentGraphEdge, ContentGraphNode } from "@/lib/content";
import { getRelationTypeLabel } from "@/lib/technology-localization";

interface ContentNetworkGraphProps {
  nodes: ContentGraphNode[];
  edges: ContentGraphEdge[];
}

type Point = { x: number; y: number };
type PositionMap = Record<string, Point>;

interface PositionedNode extends ContentGraphNode {
  x: number;
  y: number;
}

// Hand-written force-directed layout (Fruchterman-Reingold style): nodes
// repel each other, edges pull their endpoints together, and a weak
// centering force keeps the graph from drifting off-canvas. The coordinate
// space is a 0-100 square matching the canvas's 1:1 CSS aspect-ratio, so
// on-screen distances line up with the physics distances (no distortion).
const VIEW_SIZE = 100;
const PAD = 6;
const SIM_FRAMES = 150;
const SIM_START_TEMPERATURE = 10;

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// A node/edge is dimmed only if it fails every currently-active highlight
// criterion (search, category filter, selection). With two independent
// lenses active at once, this is a union: something visible under either
// lens stays visible, rather than requiring both -- selecting a node with
// no connections matching the current search would otherwise dim the
// entire graph to nothing.
function isDimmedByActiveChecks(checks: boolean[]): boolean {
  return checks.length > 0 && !checks.some(Boolean);
}

// Deterministic (not Math.random), so the server-rendered markup and the
// client's first paint agree before the physics effect starts animating it.
function hashId(id: string): number {
  let hash = 0;

  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }

  return Math.abs(hash);
}

// Server-safe: a plain grid using only +/-/*//, which the spec guarantees
// produces bit-identical results on any engine. Used for the very first
// render (SSR + hydration) so there is nothing for React to mismatch on.
function gridLayout(nodes: ContentGraphNode[]): PositionMap {
  const positions: PositionMap = {};
  const usable = VIEW_SIZE - PAD * 2;
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const rows = Math.max(1, Math.ceil(nodes.length / columns));

  nodes.forEach((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    positions[node.id] = {
      x: PAD + ((column + 0.5) * usable) / columns,
      y: PAD + ((row + 0.5) * usable) / rows
    };
  });

  return positions;
}

// Client-only starting scatter for the physics animation. Math.cos/Math.sin
// are not spec-guaranteed to be bit-identical across engines, so this must
// never be used for the initial render state — only applied from inside an
// effect, after hydration has already completed.
function scatterLayout(nodes: ContentGraphNode[]): PositionMap {
  const positions: PositionMap = {};

  nodes.forEach((node) => {
    const seed = hashId(node.id);
    const angle = (seed % 360) * (Math.PI / 180);
    const radius = 14 + (seed % 29);

    positions[node.id] = {
      x: clamp(VIEW_SIZE / 2 + Math.cos(angle) * radius, PAD, VIEW_SIZE - PAD),
      y: clamp(VIEW_SIZE / 2 + Math.sin(angle) * radius, PAD, VIEW_SIZE - PAD)
    };
  });

  return positions;
}

function stepForceLayout(
  positions: PositionMap,
  nodes: ContentGraphNode[],
  edges: ContentGraphEdge[],
  temperature: number,
  pinnedId: string | null
): PositionMap {
  const idealDistance = Math.sqrt(
    (VIEW_SIZE * VIEW_SIZE) / Math.max(nodes.length, 1)
  );
  const displacement: PositionMap = {};

  nodes.forEach((node) => {
    displacement[node.id] = { x: 0, y: 0 };
  });

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i].id;
      const b = nodes[j].id;
      const pa = positions[a];
      const pb = positions[b];

      if (!pa || !pb) {
        continue;
      }

      const dx = pa.x - pb.x;
      const dy = pa.y - pb.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (idealDistance * idealDistance) / distance;

      displacement[a].x += (dx / distance) * force;
      displacement[a].y += (dy / distance) * force;
      displacement[b].x -= (dx / distance) * force;
      displacement[b].y -= (dy / distance) * force;
    }
  }

  edges.forEach((edge) => {
    const pa = positions[edge.sourceId];
    const pb = positions[edge.targetId];

    if (!pa || !pb) {
      return;
    }

    const dx = pa.x - pb.x;
    const dy = pa.y - pb.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const force = (distance * distance) / idealDistance;

    displacement[edge.sourceId].x -= (dx / distance) * force;
    displacement[edge.sourceId].y -= (dy / distance) * force;
    displacement[edge.targetId].x += (dx / distance) * force;
    displacement[edge.targetId].y += (dy / distance) * force;
  });

  const center = VIEW_SIZE / 2;

  nodes.forEach((node) => {
    const p = positions[node.id];

    if (!p) {
      return;
    }

    displacement[node.id].x += (center - p.x) * 0.01;
    displacement[node.id].y += (center - p.y) * 0.01;
  });

  const next: PositionMap = {};

  nodes.forEach((node) => {
    const p = positions[node.id];

    if (!p) {
      return;
    }

    if (node.id === pinnedId) {
      next[node.id] = p;
      return;
    }

    const d = displacement[node.id];
    const dLength = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
    const limited = Math.min(dLength, temperature);

    next[node.id] = {
      x: clamp(p.x + (d.x / dLength) * limited, PAD, VIEW_SIZE - PAD),
      y: clamp(p.y + (d.y / dLength) * limited, PAD, VIEW_SIZE - PAD)
    };
  });

  return next;
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
  const [positions, setPositions] = useState<PositionMap>(() =>
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
    // Safe to use Math.cos/Math.sin here: this effect only runs client-side,
    // after hydration has already reconciled against the SSR-safe grid.
    setPositions(scatterLayout(nodes));

    let frame = 0;
    let raf = 0;

    const step = () => {
      const temperature = SIM_START_TEMPERATURE * (1 - frame / SIM_FRAMES);

      setPositions((prev) =>
        stepForceLayout(prev, nodes, edges, temperature, draggingIdRef.current)
      );

      frame += 1;

      if (frame < SIM_FRAMES) {
        raf = requestAnimationFrame(step);
      }
    };

    raf = requestAnimationFrame(step);

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
              {connections.length > 0 ? (
                <ul className="content-network__panel-list">
                  {connections.map((connection) => (
                    <li key={connection.id}>
                      <DossierStampTag>
                        {getRelationTypeLabel(connection.relationType, "zh")}
                      </DossierStampTag>
                      <Link href={connection.node.href}>
                        {connection.node.title}
                      </Link>
                    </li>
                  ))}
                </ul>
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
