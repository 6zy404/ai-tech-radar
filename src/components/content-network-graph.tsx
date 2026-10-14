"use client";

import Link from "next/link";
import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DossierCategoryChips } from "@/components/dossier-category-chips";
import { DossierSearchInput } from "@/components/dossier-search-input";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import type { ContentGraphEdge, ContentGraphNode } from "@/lib/content";
import { withNetworkFocus } from "@/lib/network-focus";
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
import { networkCopy } from "@/lib/i18n/copy/network";
import { useLocale } from "@/lib/i18n/use-locale";
import { getRelationTypeLabel } from "@/lib/technology-localization";

interface ContentNetworkGraphProps {
  nodes: ContentGraphNode[];
  edges: ContentGraphEdge[];
  /** From `?focus=`, already checked against `nodes` by the page. */
  initialFocusId?: string | null;
  /** `lang` per node id whose title is not in the page's language. */
  nodeLangs?: Record<string, string>;
}

interface PositionedNode extends ContentGraphNode {
  x: number;
  y: number;
}

// How long the nodes take to travel from the server-rendered grid to the
// settled layout. The layout maths itself lives in `@/lib/network-layout`.
const UNFOLD_MS = 700;

// A press that travels further than this before release is a drag, not a
// click.
const DRAG_THRESHOLD_PX = 4;

const kindOrder: ContentGraphNode["kind"][] = [
  "technology",
  "skill",
  "knowledge"
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
  edges,
  initialFocusId = null,
  nodeLangs = {}
}: ContentNetworkGraphProps) {
  const locale = useLocale();
  const copy = networkCopy[locale];
  const kindLabel = copy.kinds;
  const kindFilterOptions = [
    { value: "", label: copy.allKinds },
    ...kindOrder.map((kind) => ({ value: kind, label: kindLabel[kind] }))
  ];
  const relationLabel = (type: ContentGraphEdge["relationType"]) =>
    getRelationTypeLabel(type, "zh", locale);
  // Selection is by id and independent of positions, so a focused node is
  // selected in the server-rendered markup and stays selected through the
  // glide into the settled layout.
  const [selectedId, setSelectedId] = useState<string | null>(initialFocusId);
  const [hasSettled, setHasSettled] = useState(false);
  const hasRevealedFocusRef = useRef(false);
  const [searchText, setSearchText] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [positions, setPositions] = useState<LayoutPositions>(() =>
    gridLayout(nodes)
  );
  const draggingIdRef = useRef<string | null>(null);
  // Where the pointer went down, and whether it has since moved far enough to
  // count as a drag. A drag ends with a click on the same button (the pointer
  // is captured), and that click must not toggle the selection.
  const dragStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(
    null
  );

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
      setHasSettled(true);
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
      } else {
        setHasSettled(true);
      }
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
    // Layout only needs to restart when the set of nodes/edges actually
    // changes identity, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeKey, edgeKey]);

  // Keeps `?focus=` in step with the selection so the address bar can be
  // copied and shared. replaceState, not a navigation: the page does not
  // re-render on the server, and clicking around does not fill the back
  // button with one entry per node.
  useEffect(() => {
    const next = withNetworkFocus(window.location.href, selectedId);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (next !== current) {
      window.history.replaceState(null, "", next);
    }
  }, [selectedId]);

  // A deep-linked node can sit below the fold, since the canvas is square.
  // Scrolled to once, after the glide ends, because until then the node is
  // still on its way to where it will be.
  useEffect(() => {
    if (!hasSettled || !initialFocusId || hasRevealedFocusRef.current) {
      return;
    }

    hasRevealedFocusRef.current = true;

    if (selectedId !== initialFocusId) {
      return;
    }

    const element = document.querySelector<HTMLElement>(
      `[data-node-id="${CSS.escape(initialFocusId)}"]`
    );

    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();

    if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // "nearest", not "center": the side panel is sticky only within the
    // canvas's height, so centering a node near the bottom of the canvas
    // pushed the panel's title up under the top nav. The node's
    // scroll-margin keeps it clear of the viewport edge.
    element.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth"
    });
  }, [hasSettled, initialFocusId, selectedId]);

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
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      moved: false
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const id = draggingIdRef.current;

    if (!id) {
      return;
    }

    const start = dragStartRef.current;

    if (
      start &&
      !start.moved &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) >
        DRAG_THRESHOLD_PX
    ) {
      start.moved = true;
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

  // Also on lostpointercapture, which follows every pointerup — so it must
  // leave dragStartRef for the click that comes after it.
  const handlePointerUp = () => {
    draggingIdRef.current = null;
  };

  // A cancelled pointer is never followed by a click.
  const handlePointerCancel = () => {
    draggingIdRef.current = null;
    dragStartRef.current = null;
  };

  const handleNodeButtonClick = (id: string) => {
    const wasDrag = dragStartRef.current?.moved ?? false;

    dragStartRef.current = null;

    if (!wasDrag) {
      handleNodeClick(id);
    }
  };

  const matchedCount = nodes.filter(matchesFilter).length;
  const relationTypes = useMemo(
    () =>
      Array.from(new Set(edges.map((edge) => edge.relationType))).sort((a, b) =>
        getRelationTypeLabel(a, "zh", locale).localeCompare(
          getRelationTypeLabel(b, "zh", locale),
          locale
        )
      ),
    [edges, locale]
  );

  return (
    <div className="content-network">
      <div className="content-network__controls">
        <DossierSearchInput
          value={searchText}
          onChange={setSearchText}
          placeholder={copy.searchPlaceholder}
          label={copy.searchPlaceholder}
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
                data-node-id={node.id}
                className={className}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                onClick={() => handleNodeButtonClick(node.id)}
                onPointerDown={(event) => handlePointerDown(event, node.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onLostPointerCapture={handlePointerUp}
                onPointerEnter={() => setHoveredNodeId(node.id)}
                onPointerLeave={() =>
                  setHoveredNodeId((current) =>
                    current === node.id ? null : current
                  )
                }
                // Keyboard focus shows the name as hovering does: a focused
                // dot alone does not say which node it is.
                onFocus={() => setHoveredNodeId(node.id)}
                onBlur={() =>
                  setHoveredNodeId((current) =>
                    current === node.id ? null : current
                  )
                }
                aria-pressed={isSelected}
                aria-label={`${kindLabel[node.kind]}：${node.title}`}
                title={node.title}
                lang={nodeLangs[node.id]}
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
              {relationLabel(hoveredEdge.relationType)}
            </div>
          ) : null}
        </div>

        {/* Not a live region: it is replaced whole on every selection, and a
            well-connected node lists forty-odd rows. The status line at its
            end says what changed. */}
        <aside className="content-network__panel">
          {selectedNode ? (
            <>
              <p className="technology-detail-section__eyebrow">
                {kindLabel[selectedNode.kind]}
              </p>
              <h3 lang={nodeLangs[selectedNode.id]}>{selectedNode.title}</h3>
              <Link className="action-link" href={selectedNode.href}>
                {copy.openDetail}
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
                            {relationLabel(connection.relationType)}
                          </DossierStampTag>
                          <Link
                            href={connection.node.href}
                            lang={nodeLangs[connection.node.id]}
                          >
                            {connection.node.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="content-network__panel-empty">
                  {copy.noConnections}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="content-network__panel-hint">{copy.hint}</p>
              <ul className="content-network__legend">
                <li className="content-network__legend-item content-network__legend-item--technology">
                  {kindLabel.technology}
                </li>
                <li className="content-network__legend-item content-network__legend-item--skill">
                  {kindLabel.skill}
                </li>
                <li className="content-network__legend-item content-network__legend-item--knowledge">
                  {kindLabel.knowledge}
                </li>
              </ul>
              {relationTypes.length > 0 ? (
                <>
                  <p className="content-network__legend-heading">
                    {copy.relationTypes}
                  </p>
                  <div className="content-network__relation-legend">
                    {relationTypes.map((relationType) => (
                      <DossierStampTag key={relationType}>
                        {relationLabel(relationType)}
                      </DossierStampTag>
                    ))}
                  </div>
                </>
              ) : null}
              <p className="content-network__panel-count">
                {isFilterActive
                  ? copy.matched(matchedCount, nodes.length)
                  : copy.counts(nodes.length, edges.length)}
              </p>
            </>
          )}
          <p className="signal-shortcut-help__live" role="status">
            {selectedNode
              ? locale === "en"
                ? `Selected ${kindLabel[selectedNode.kind]}: ${selectedNode.title}, ${connections.length} connection${connections.length === 1 ? "" : "s"}`
                : `已选中${kindLabel[selectedNode.kind]}「${selectedNode.title}」，${connections.length} 个连接`
              : ""}
          </p>
        </aside>
      </div>
    </div>
  );
}
