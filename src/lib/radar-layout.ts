import { radarQuadrants, radarRings } from "@/lib/radar-labels";
import type { RadarQuadrant, RadarRing } from "@/types/radar";

// Where each dot sits on the /radar picture. Deterministic: the same entries
// always land in the same places, on the server and in every browser, with
// no random numbers. Pure — no node imports — so tests and the client can
// both read it.
//
// Each (quadrant, ring) cell is cut into a polar grid of slots spaced far
// enough apart that two dots can never touch, kept clear of the ring
// boundaries and of the two dividing lines. An entry's id hashes to a slot;
// a taken slot passes it on to the next free one. So the picture looks
// scattered, but no two dots overlap and no dot crosses into a neighbouring
// cell — both properties the tests pin.

export const radarViewBox = 640;
export const radarCenter = radarViewBox / 2;
/** Outer radius of each ring, innermost first (adopt → hold). */
export const radarRingRadii: readonly number[] = [150, 220, 272, 312];
/** Dot radius. */
export const radarDotRadius = 12;

/** Minimum centre-to-centre distance between two dots in one cell. */
const preferredSpacing = 30;
const minimumSpacing = 2 * radarDotRadius + 2;
/** Clearance from a ring boundary or a dividing line, measured to the centre. */
const edgePadding = radarDotRadius + 6;
/** Small offset inside a slot, so rows do not read as a grid. */
const maxJitter = 2;

export interface RadarLayoutInput {
  id: string;
  quadrant: RadarQuadrant;
  ring: RadarRing;
}

export interface RadarDotPosition {
  id: string;
  x: number;
  y: number;
}

/** FNV-1a, 32-bit. Stable across runtimes; enough spread for slot picking. */
export function hashRadarId(value: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * The quadrant's angular range in standard maths orientation (radians,
 * counter-clockwise from +x, y up), clockwise from the top-right in the
 * order of `radarQuadrants`.
 */
export function getQuadrantAngleRange(quadrant: RadarQuadrant): {
  start: number;
  end: number;
} {
  const quarter = Math.PI / 2;
  const starts: Record<RadarQuadrant, number> = {
    "models-training": 0,
    "agents-applications": 3 * quarter,
    "inference-deployment": 2 * quarter,
    "tools-methods": quarter
  };
  const start = starts[quadrant];

  return { start, end: start + quarter };
}

export function getRingBounds(ring: RadarRing): {
  inner: number;
  outer: number;
} {
  const index = radarRings.indexOf(ring);

  return {
    inner: index === 0 ? 0 : radarRingRadii[index - 1],
    outer: radarRingRadii[index]
  };
}

interface Slot {
  radius: number;
  angle: number;
  /** Room left in the slot for jitter, along each axis. */
  slack: number;
}

/** The slot grid of one cell, row by row from the inside out. */
export function buildCellSlots(
  quadrant: RadarQuadrant,
  ring: RadarRing,
  spacing = preferredSpacing
): Slot[] {
  const { start } = getQuadrantAngleRange(quadrant);
  const { inner, outer } = getRingBounds(ring);
  const slots: Slot[] = [];
  const slack = Math.max(
    0,
    Math.min(maxJitter, (spacing - minimumSpacing) / 2)
  );
  // Rows are at least `spacing` apart radially, so dots in different rows
  // can never be closer than that, and are spread over the whole band; the
  // first row of the centre cell starts where the two dividing lines are far
  // enough apart to fit a dot at all.
  const firstRow = Math.max(inner + edgePadding, edgePadding * Math.SQRT2 + 1);
  const lastRow = outer - edgePadding;

  if (lastRow < firstRow) {
    return slots;
  }

  const rowCount = Math.floor((lastRow - firstRow) / spacing) + 1;
  const rowStep = rowCount > 1 ? (lastRow - firstRow) / (rowCount - 1) : 0;
  const rows = Array.from({ length: rowCount }, (_, index) =>
    rowCount === 1 ? (firstRow + lastRow) / 2 : firstRow + rowStep * index
  );

  for (const radius of rows) {
    // A point at angle φ inside the quadrant is r·sin φ from one dividing
    // line and r·sin(90° − φ) from the other; both must clear the padding.
    const margin = Math.asin(Math.min(1, edgePadding / radius));
    const span = Math.PI / 2 - 2 * margin;

    if (span < 0) {
      continue;
    }

    // Equal sub-arcs, one dot in the middle of each. The chord between two
    // neighbours is 2r·sin(step/2), which must be at least `spacing`.
    const maxCount = Math.floor(
      span / (2 * Math.asin(Math.min(1, spacing / (2 * radius))))
    );
    const count = Math.max(1, maxCount);
    const step = span / count;

    for (let index = 0; index < count; index += 1) {
      slots.push({
        radius,
        angle: start + margin + step * (index + 0.5),
        slack
      });
    }
  }

  return slots;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function toPosition(id: string, slot: Slot): RadarDotPosition {
  const hash = hashRadarId(`${id}#jitter`);
  // Two independent offsets in [-slack, slack] from the hash's halves.
  const dx = (((hash & 0xffff) / 0xffff) * 2 - 1) * slot.slack;
  const dy = ((((hash >>> 16) & 0xffff) / 0xffff) * 2 - 1) * slot.slack;

  return {
    id,
    x: round(radarCenter + slot.radius * Math.cos(slot.angle) + dx),
    // SVG y grows downwards.
    y: round(radarCenter - slot.radius * Math.sin(slot.angle) + dy)
  };
}

function layoutCell(
  quadrant: RadarQuadrant,
  ring: RadarRing,
  ids: string[]
): RadarDotPosition[] {
  // Tighten the grid only as far as the dots still cannot touch; a cell
  // that does not fit even then is a content problem the tests catch.
  let slots = buildCellSlots(quadrant, ring);

  for (
    let spacing = preferredSpacing - 1;
    slots.length < ids.length && spacing >= minimumSpacing;
    spacing -= 1
  ) {
    slots = buildCellSlots(quadrant, ring, spacing);
  }

  const taken = new Set<number>();
  // Sorted so the result does not depend on the order entries arrive in.
  const ordered = [...ids].sort();

  return ordered.map((id) => {
    if (slots.length === 0) {
      return { id, x: radarCenter, y: radarCenter };
    }

    let slotIndex = hashRadarId(id) % slots.length;

    if (taken.size < slots.length) {
      while (taken.has(slotIndex)) {
        slotIndex = (slotIndex + 1) % slots.length;
      }
    }

    taken.add(slotIndex);

    return toPosition(id, slots[slotIndex]);
  });
}

/** One position per entry, keyed by id. */
export function layoutRadarDots(
  entries: RadarLayoutInput[]
): Map<string, RadarDotPosition> {
  const positions = new Map<string, RadarDotPosition>();

  for (const quadrant of radarQuadrants) {
    for (const ring of radarRings) {
      const ids = entries
        .filter((entry) => entry.quadrant === quadrant && entry.ring === ring)
        .map((entry) => entry.id);

      for (const position of layoutCell(quadrant, ring, ids)) {
        positions.set(position.id, position);
      }
    }
  }

  return positions;
}

/** How many dots a cell holds before they would have to touch. */
export function getRadarCellCapacity(
  quadrant: RadarQuadrant,
  ring: RadarRing
): number {
  return buildCellSlots(quadrant, ring, minimumSpacing).length;
}
