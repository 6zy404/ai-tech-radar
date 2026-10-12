import { describe, expect, it } from "vitest";

import { radarEntries } from "@/data/radar";
import { radarQuadrants, radarRings } from "@/lib/radar-labels";
import {
  buildCellSlots,
  getQuadrantAngleRange,
  getRadarCellCapacity,
  getRingBounds,
  hashRadarId,
  layoutRadarDots,
  radarCenter,
  radarDotRadius,
  type RadarLayoutInput
} from "@/lib/radar-layout";
import type { RadarQuadrant, RadarRing } from "@/types/radar";

function polar(x: number, y: number) {
  const dx = x - radarCenter;
  const dy = radarCenter - y;
  let angle = Math.atan2(dy, dx);

  if (angle < 0) {
    angle += 2 * Math.PI;
  }

  return { radius: Math.hypot(dx, dy), angle };
}

function expectInsideCell(
  x: number,
  y: number,
  quadrant: RadarQuadrant,
  ring: RadarRing
) {
  const { radius, angle } = polar(x, y);
  const { inner, outer } = getRingBounds(ring);
  const { start, end } = getQuadrantAngleRange(quadrant);

  // The whole dot stays inside its ring band…
  expect(radius - radarDotRadius).toBeGreaterThanOrEqual(inner);
  expect(radius + radarDotRadius).toBeLessThanOrEqual(outer);
  // …and on its side of both dividing lines.
  expect(angle).toBeGreaterThan(start);
  expect(angle).toBeLessThan(end);
  expect(radius * Math.sin(angle - start)).toBeGreaterThanOrEqual(
    radarDotRadius
  );
  expect(radius * Math.sin(end - angle)).toBeGreaterThanOrEqual(radarDotRadius);
}

function crowd(quadrant: RadarQuadrant, ring: RadarRing, count: number) {
  return Array.from({ length: count }, (_, index): RadarLayoutInput => ({
    id: `entry-${quadrant}-${ring}-${index}`,
    quadrant,
    ring
  }));
}

describe("layoutRadarDots", () => {
  it("places every seed entry inside its own cell with no two dots touching", () => {
    const positions = layoutRadarDots(radarEntries);
    const placed = radarEntries.map((entry) => ({
      entry,
      position: positions.get(entry.id)!
    }));

    expect(positions.size).toBe(radarEntries.length);

    for (const { entry, position } of placed) {
      expectInsideCell(position.x, position.y, entry.quadrant, entry.ring);
    }

    for (let a = 0; a < placed.length; a += 1) {
      for (let b = a + 1; b < placed.length; b += 1) {
        const distance = Math.hypot(
          placed[a].position.x - placed[b].position.x,
          placed[a].position.y - placed[b].position.y
        );

        expect(distance).toBeGreaterThanOrEqual(2 * radarDotRadius);
      }
    }
  });

  it("gives the same positions whatever order the entries arrive in", () => {
    const forward = layoutRadarDots(radarEntries);
    const backward = layoutRadarDots([...radarEntries].reverse());

    for (const entry of radarEntries) {
      expect(backward.get(entry.id)).toEqual(forward.get(entry.id));
    }
  });

  it("does not move an entry when an entry in another cell is added", () => {
    const before = layoutRadarDots(radarEntries);
    const after = layoutRadarDots([
      ...radarEntries,
      { id: "radar-new-elsewhere", quadrant: "tools-methods", ring: "assess" }
    ]);

    for (const entry of radarEntries.filter(
      (item) => !(item.quadrant === "tools-methods" && item.ring === "assess")
    )) {
      expect(after.get(entry.id)).toEqual(before.get(entry.id));
    }
  });

  it("keeps a full cell overlap-free, down to its stated capacity", () => {
    for (const quadrant of radarQuadrants) {
      for (const ring of radarRings) {
        const capacity = getRadarCellCapacity(quadrant, ring);
        const entries = crowd(quadrant, ring, capacity);
        const positions = [...layoutRadarDots(entries).values()];

        for (const position of positions) {
          expectInsideCell(position.x, position.y, quadrant, ring);
        }

        for (let a = 0; a < positions.length; a += 1) {
          for (let b = a + 1; b < positions.length; b += 1) {
            expect(
              Math.hypot(
                positions[a].x - positions[b].x,
                positions[a].y - positions[b].y
              )
            ).toBeGreaterThanOrEqual(2 * radarDotRadius);
          }
        }
      }
    }
  });

  it("leaves every seed cell room to grow at the roomy spacing", () => {
    for (const quadrant of radarQuadrants) {
      for (const ring of radarRings) {
        const used = radarEntries.filter(
          (entry) => entry.quadrant === quadrant && entry.ring === ring
        ).length;

        expect(buildCellSlots(quadrant, ring).length).toBeGreaterThanOrEqual(
          used + 3
        );
      }
    }
  });
});

describe("hashRadarId", () => {
  it("is stable", () => {
    expect(hashRadarId("radar-vllm")).toBe(hashRadarId("radar-vllm"));
    expect(hashRadarId("radar-vllm")).not.toBe(hashRadarId("radar-mcp"));
  });
});
