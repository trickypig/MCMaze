import { describe, it, expect } from "vitest";
import { buildSpawnManifest } from "../src/generation/spawn_plan";
import type { Maze, Cell, Coord } from "../src/generation/maze";

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
