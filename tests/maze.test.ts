import { describe, it, expect } from "vitest";
import { generateMaze, type Maze } from "../src/generation/maze";

// Seeded PRNG for determinism in tests — xorshift32.
function seededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

describe("generateMaze — cell grid shape", () => {
  it("produces a grid of the requested width and height", () => {
    const rng = seededRng(42);
    const maze: Maze = generateMaze(12, 12, rng);
    expect(maze.cells.length).toBe(12);
    expect(maze.cells[0].length).toBe(12);
  });

  it("every cell has four wall flags", () => {
    const rng = seededRng(42);
    const maze = generateMaze(5, 5, rng);
    for (const row of maze.cells) {
      for (const cell of row) {
        expect(typeof cell.walls.N).toBe("boolean");
        expect(typeof cell.walls.S).toBe("boolean");
        expect(typeof cell.walls.E).toBe("boolean");
        expect(typeof cell.walls.W).toBe("boolean");
      }
    }
  });
});

describe("generateMaze — connectivity", () => {
  it("every cell is reachable from the entrance", () => {
    const rng = seededRng(99);
    const maze = generateMaze(10, 10, rng);
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        expect(maze.bfsDistance({ x, y })).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("exit is strictly further from entrance than most cells", () => {
    const rng = seededRng(99);
    const maze = generateMaze(10, 10, rng);
    const exitDist = maze.bfsDistance(maze.exit);
    expect(exitDist).toBeGreaterThan(0);
    // At least 80% of cells should be closer than or equal to the exit.
    let closer = 0;
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        if (maze.bfsDistance({ x, y }) <= exitDist) closer++;
      }
    }
    expect(closer / 100).toBeGreaterThanOrEqual(0.8);
  });

  it("entrance is not the exit", () => {
    const rng = seededRng(7);
    const maze = generateMaze(8, 8, rng);
    expect(maze.exit.x === 0 && maze.exit.y === 0).toBe(false);
  });

  it("finds at least one dead end for nontrivial sizes", () => {
    const rng = seededRng(7);
    const maze = generateMaze(12, 12, rng);
    expect(maze.deadEnds.length).toBeGreaterThan(0);
  });
});

describe("generateMaze — determinism", () => {
  it("same seed produces same maze", () => {
    const a = generateMaze(8, 8, seededRng(123));
    const b = generateMaze(8, 8, seededRng(123));
    expect(JSON.stringify(a.cells)).toBe(JSON.stringify(b.cells));
    expect(a.exit).toEqual(b.exit);
  });
});
