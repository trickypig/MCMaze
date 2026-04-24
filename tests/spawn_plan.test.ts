import { describe, it, expect } from "vitest";
import { buildSpawnManifest } from "../src/generation/spawn_plan";
import type { Maze, Cell, Coord } from "../src/generation/maze";
import { generateMaze } from "../src/generation/maze";

/**
 * Build a Maze fixture with no walls broken along a single straight N-S
 * corridor of `length` cells at x=0, y=0..length-1. Used to verify detection
 * of straight runs.
 */
function straightCorridorMaze(length: number): Maze {
  const cells: Cell[][] = [[]];
  for (let y = 0; y < length; y++) {
    cells[0].push({
      walls: {
        N: y === 0,
        S: y === length - 1,
        E: true,
        W: true,
      },
    });
  }
  const entrance: Coord = { x: 0, y: 0 };
  const exit: Coord = { x: 0, y: length - 1 };
  return {
    cells,
    entrance,
    exit,
    deadEnds: [{ x: 0, y: length - 1 }],
    bfsDistance: (c) => c.y,
  };
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe("buildSpawnManifest", () => {
  it("returns an empty manifest when the maze has no runs ≥ 4 cells", () => {
    const maze = straightCorridorMaze(3); // too short
    const manifest = buildSpawnManifest(maze, 1, mulberry32(1));
    expect(manifest).toEqual([]);
  });
});

describe("buildSpawnManifest — straight runs", () => {
  it("detects a single N-S run and emits one patroller entry", () => {
    // 6-cell N-S corridor: entrance=(0,0), exit=(0,5). Interior cells y=1..4
    // are all NS-through and form a 4-cell run that excludes both endpoints,
    // so exactly one patroller entry should be emitted.
    const maze = straightCorridorMaze(6);
    const manifest = buildSpawnManifest(maze, 1, mulberry32(42));
    expect(manifest.length).toBe(1);
    expect(manifest[0].behavior).toBe("patroller");
    expect(manifest[0].theme).toBe("old_prison");
    expect(["N", "S"]).toContain(manifest[0].config.patrolAxis);
    expect(manifest[0].config.patrolLength).toBe(12);
  });

  it("emits a patroller when a run excludes entrance and exit", () => {
    // Build a wider maze: two parallel 6-cell N-S corridors joined at the top.
    // Left corridor holds entrance; right corridor's bottom cell holds exit.
    // The right corridor's interior run (cells y=1..4) is a 4-cell run with
    // neither endpoint — eligible.
    const cells: Cell[][] = [[], []];
    for (let y = 0; y < 6; y++) {
      // Left column: N/S open except top; top is open E so it joins right.
      cells[0].push({
        walls: {
          N: y === 0,
          S: y === 5,
          E: y !== 0, // open E at y=0
          W: true,
        },
      });
      // Right column: N/S open except top and bottom walls; top open W.
      cells[1].push({
        walls: {
          N: y === 0,
          S: y === 5,
          E: true,
          W: y !== 0, // open W at y=0
        },
      });
    }
    const maze: Maze = {
      cells,
      entrance: { x: 0, y: 5 },
      exit: { x: 1, y: 5 },
      deadEnds: [{ x: 0, y: 5 }, { x: 1, y: 5 }],
      bfsDistance: (c) => (c.x === 0 ? 5 - c.y : 6 + c.y),
    };
    const manifest = buildSpawnManifest(maze, 1, mulberry32(7));
    expect(manifest.length).toBeGreaterThanOrEqual(1);
    const entry = manifest[0];
    expect(entry.behavior).toBe("patroller");
    expect(entry.theme).toBe("old_prison");
    expect(["N", "S"]).toContain(entry.config.patrolAxis);
    expect(entry.config.patrolLength).toBeGreaterThanOrEqual(12); // 4 cells × 3
  });

  it("is deterministic for the same seed", () => {
    const maze = straightCorridorMaze(6);
    const a = buildSpawnManifest(maze, 1, mulberry32(99));
    const b = buildSpawnManifest(maze, 1, mulberry32(99));
    expect(a).toEqual(b);
  });
});

describe("buildSpawnManifest — real maze density", () => {
  it("produces entries on a 12×12 L1 maze", () => {
    const maze = generateMaze(12, 12, mulberry32(123));
    const manifest = buildSpawnManifest(maze, 1, mulberry32(456));
    // With ~1 per 12 cells and 144 cells, target is 12; but eligible-run
    // count may be smaller. Assert plausible bounds, not an exact number.
    expect(manifest.length).toBeGreaterThan(0);
    expect(manifest.length).toBeLessThanOrEqual(12);
  });

  it("never places an entry on the entrance or exit cell", () => {
    const maze = generateMaze(12, 12, mulberry32(321));
    const manifest = buildSpawnManifest(maze, 1, mulberry32(654));
    const ex = maze.entrance;
    const xt = maze.exit;
    for (const entry of manifest) {
      const cellX = Math.floor((entry.pos.x - 2) / 3);
      const cellY = Math.floor((entry.pos.z - 2) / 3);
      expect({ x: cellX, y: cellY }).not.toEqual(ex);
      expect({ x: cellX, y: cellY }).not.toEqual(xt);
    }
  });
});
