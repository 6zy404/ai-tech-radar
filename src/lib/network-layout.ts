/**
 * The layout maths behind `/network`, kept free of React so that it can be
 * measured and tested.
 *
 * Hand-written force-directed layout (Fruchterman-Reingold style): nodes repel
 * each other, edges pull their endpoints together, and a weak centering force
 * keeps the graph from drifting off-canvas. The coordinate space is a 0-100
 * square matching the canvas's 1:1 CSS aspect-ratio, so on-screen distances
 * line up with the physics distances (no distortion).
 *
 * **The simulation is run to the end before anything is drawn.** Until
 * 2026-09-28 every one of its 150 steps was painted. A step moves a node by up
 * to `temperature` canvas units in the direction of its net force, and on a
 * dense graph the net force on almost every node exceeds that cap — so a node
 * overshoots, the force reverses, and it is thrown back. Measured on the real
 * 126-node, 890-edge graph: nodes reversed direction on 93.5% of the frames in
 * which they moved, travelling 7.7 canvas units per frame over the first 60 —
 * about 52px on a 674px canvas. The simulation does not converge on a graph
 * this dense; it oscillates until the temperature reaches zero and stops
 * wherever it happens to be. Readers saw that as the page convulsing.
 *
 * The steps are unchanged, so the picture a reader ends up with is the one
 * they always ended up with; they are simply no longer shown. All 150 take
 * about 50ms. What is shown instead is a straight glide from the grid the
 * server rendered to the settled layout — see `interpolateLayout`.
 */

export type LayoutPoint = { x: number; y: number };
export type LayoutPositions = Record<string, LayoutPoint>;

export interface LayoutNode {
  id: string;
}

export interface LayoutEdge {
  sourceId: string;
  targetId: string;
}

export const VIEW_SIZE = 100;
export const PAD = 6;
export const SIM_FRAMES = 150;
export const SIM_START_TEMPERATURE = 10;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Deterministic (not Math.random), so the same graph always settles into the
// same picture.
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
export function gridLayout(nodes: LayoutNode[]): LayoutPositions {
  const positions: LayoutPositions = {};
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

// Client-only starting scatter for the simulation. Math.cos/Math.sin are not
// spec-guaranteed to be bit-identical across engines, so this must never be
// used for the initial render state — only from inside an effect, after
// hydration has already completed.
export function scatterLayout(nodes: LayoutNode[]): LayoutPositions {
  const positions: LayoutPositions = {};

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

export function stepForceLayout(
  positions: LayoutPositions,
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  temperature: number,
  pinnedId: string | null
): LayoutPositions {
  // The 1.2 is measured, not tuned by eye. The bare sqrt spaces nodes to fill
  // the canvas exactly, which leaves no room for the dot's own diameter once
  // the graph is dense — this page has grown from the 33 nodes the layout was
  // written for in 2026-07-15 to 94 nodes and 504 edges. Raising it spreads
  // the cloud without pushing anything against the padding wall: measured over
  // repeated loads at 1440 and 390, overlapping hit areas go 21 → 15 and
  // 213 → 155, overlapping dots 12 → 7 at 390, and nodes outside the canvas
  // stay at 0 with the cloud filling 89% of it.
  const idealDistance =
    1.2 * Math.sqrt((VIEW_SIZE * VIEW_SIZE) / Math.max(nodes.length, 1));
  const displacement: LayoutPositions = {};

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

  const next: LayoutPositions = {};

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

/**
 * Runs the whole simulation and returns where it ends. The same steps, in the
 * same order, from the same scatter as the animation that used to be painted,
 * so the picture a reader ends up with is the one they always ended up with.
 *
 * `onStep` exists for measurement; the page does not use it.
 */
export function settleForceLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  onStep?: (positions: LayoutPositions, frame: number) => void
): LayoutPositions {
  let positions = scatterLayout(nodes);

  for (let frame = 0; frame < SIM_FRAMES; frame += 1) {
    const temperature = SIM_START_TEMPERATURE * (1 - frame / SIM_FRAMES);

    positions = stepForceLayout(positions, nodes, edges, temperature, null);
    onStep?.(positions, frame);
  }

  return positions;
}

/** Decelerating: fast at first, easing into the final position. */
export function easeOutCubic(progress: number): number {
  const clamped = clamp(progress, 0, 1);

  return 1 - (1 - clamped) ** 3;
}

/**
 * A straight line from one layout to another. Every node moves monotonically
 * toward where it is going, so nothing can reverse or overshoot.
 */
export function interpolateLayout(
  from: LayoutPositions,
  to: LayoutPositions,
  progress: number
): LayoutPositions {
  const amount = clamp(progress, 0, 1);
  const result: LayoutPositions = {};

  for (const id of Object.keys(to)) {
    const start = from[id] ?? to[id];
    const end = to[id];

    // Weighted rather than `start + (end - start) * amount`: in floating
    // point the latter does not land exactly on `end` at 1, and the layout a
    // reader is left with has to be the settled one, not one a hair off it.
    result[id] = {
      x: start.x * (1 - amount) + end.x * amount,
      y: start.y * (1 - amount) + end.y * amount
    };
  }

  return result;
}
