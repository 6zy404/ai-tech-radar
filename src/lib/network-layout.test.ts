import { describe, expect, it } from "vitest";

import {
  easeOutCubic,
  gridLayout,
  interpolateLayout,
  type LayoutEdge,
  type LayoutNode,
  type LayoutPositions,
  PAD,
  scatterLayout,
  settleForceLayout,
  SIM_FRAMES,
  SIM_START_TEMPERATURE,
  stepForceLayout,
  VIEW_SIZE
} from "./network-layout";

// A graph about as dense as the real one (126 nodes, 890 edges: each node
// linked to roughly one in nine of the others).
function denseGraph(size: number): {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
} {
  const nodes = Array.from({ length: size }, (_, index) => ({
    id: `node-${index}`
  }));
  const edges: LayoutEdge[] = [];

  for (let i = 0; i < size; i += 1) {
    for (let j = i + 1; j < size; j += 1) {
      if ((i * 7 + j * 13) % 9 === 0) {
        edges.push({ sourceId: nodes[i].id, targetId: nodes[j].id });
      }
    }
  }

  return { nodes, edges };
}

/** Share of moves that point against the move before them. */
function reversalRate(frames: LayoutPositions[], ids: string[]): number {
  let reversals = 0;
  let moves = 0;

  for (let f = 2; f < frames.length; f += 1) {
    for (const id of ids) {
      const a = frames[f - 2][id];
      const b = frames[f - 1][id];
      const c = frames[f][id];
      const stepX = c.x - b.x;
      const stepY = c.y - b.y;

      if (Math.hypot(stepX, stepY) < 0.001) {
        continue;
      }

      moves += 1;

      if ((b.x - a.x) * stepX + (b.y - a.y) * stepY < 0) {
        reversals += 1;
      }
    }
  }

  return moves === 0 ? 0 : reversals / moves;
}

describe("settleForceLayout", () => {
  const { nodes, edges } = denseGraph(60);

  it("ends where painting every step used to end", () => {
    let expected = scatterLayout(nodes);

    for (let frame = 0; frame < SIM_FRAMES; frame += 1) {
      expected = stepForceLayout(
        expected,
        nodes,
        edges,
        SIM_START_TEMPERATURE * (1 - frame / SIM_FRAMES),
        null
      );
    }

    expect(settleForceLayout(nodes, edges)).toEqual(expected);
  });

  it("gives the same picture every time", () => {
    expect(settleForceLayout(nodes, edges)).toEqual(
      settleForceLayout(nodes, edges)
    );
  });

  it("keeps every node inside the canvas padding", () => {
    for (const point of Object.values(settleForceLayout(nodes, edges))) {
      expect(point.x).toBeGreaterThanOrEqual(PAD);
      expect(point.x).toBeLessThanOrEqual(VIEW_SIZE - PAD);
      expect(point.y).toBeGreaterThanOrEqual(PAD);
      expect(point.y).toBeLessThanOrEqual(VIEW_SIZE - PAD);
    }
  });

  it("places every node it was given", () => {
    expect(Object.keys(settleForceLayout(nodes, edges)).sort()).toEqual(
      nodes.map((node) => node.id).sort()
    );
  });

  it("handles an empty graph and a single node", () => {
    expect(settleForceLayout([], [])).toEqual({});
    expect(Object.keys(settleForceLayout([{ id: "only" }], []))).toEqual([
      "only"
    ]);
  });
});

describe("why the simulation is not painted", () => {
  it("reverses direction on most frames on a dense graph", () => {
    const { nodes, edges } = denseGraph(60);
    const frames: LayoutPositions[] = [];

    settleForceLayout(nodes, edges, (positions) => frames.push(positions));

    expect(frames).toHaveLength(SIM_FRAMES);
    // Measured at 93.5% on the real graph. The bar here is deliberately far
    // lower: what matters is that it is nowhere near zero.
    expect(
      reversalRate(
        frames,
        nodes.map((node) => node.id)
      )
    ).toBeGreaterThan(0.5);
  });
});

describe("interpolateLayout", () => {
  const { nodes, edges } = denseGraph(40);
  const from = gridLayout(nodes);
  const to = settleForceLayout(nodes, edges);
  const ids = nodes.map((node) => node.id);

  it("starts at the first layout and ends at the second", () => {
    expect(interpolateLayout(from, to, 0)).toEqual(from);
    expect(interpolateLayout(from, to, 1)).toEqual(to);
  });

  it("never reverses on the way", () => {
    const frames = Array.from({ length: 43 }, (_, frame) =>
      interpolateLayout(from, to, easeOutCubic(frame / 42))
    );

    expect(reversalRate(frames, ids)).toBe(0);
  });

  it("holds the final layout once the time is up", () => {
    expect(interpolateLayout(from, to, 1.8)).toEqual(to);
    expect(interpolateLayout(from, to, -0.4)).toEqual(from);
  });

  it("places a node the first layout did not have at its destination", () => {
    expect(interpolateLayout({}, { added: { x: 30, y: 40 } }, 0.25)).toEqual({
      added: { x: 30, y: 40 }
    });
  });
});

describe("easeOutCubic", () => {
  it("runs from 0 to 1 and only ever increases", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);

    let previous = 0;

    for (let step = 1; step <= 20; step += 1) {
      const value = easeOutCubic(step / 20);

      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });

  it("stays within bounds outside the range", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(3)).toBe(1);
  });
});
