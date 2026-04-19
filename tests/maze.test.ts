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
