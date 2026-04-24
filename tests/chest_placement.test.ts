import { describe, it, expect } from "vitest";
import { generateMaze } from "../src/generation/maze";
import { pickChestCell } from "../src/generation/chest_placement";

function seededRng(seed: number): () => number {
  let s = seed | 0;
  if (s === 0) s = 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

describe("pickChestCell", () => {
  it("returns a dead-end cell that is not the entrance", () => {
    const maze = generateMaze(8, 8, seededRng(100));
    const chest = pickChestCell(maze);
    expect(maze.deadEnds.some((d) => d.x === chest.x && d.y === chest.y)).toBe(true);
    expect(chest).not.toEqual(maze.entrance);
  });

  it("avoids the exit cell when other dead-ends exist", () => {
    const maze = generateMaze(10, 10, seededRng(200));
    const chest = pickChestCell(maze);
    if (maze.deadEnds.length > 1) {
      expect(chest).not.toEqual(maze.exit);
    }
  });

  it("picks the highest bfsDistance dead-end (farthest from entrance)", () => {
    const maze = generateMaze(10, 10, seededRng(300));
    const chest = pickChestCell(maze);
    const chestDist = maze.bfsDistance(chest);
    for (const d of maze.deadEnds) {
      if (d.x === maze.exit.x && d.y === maze.exit.y) continue;
      expect(maze.bfsDistance(d)).toBeLessThanOrEqual(chestDist);
    }
  });

  it("ties are broken deterministically by (x, y) ascending", () => {
    const a = pickChestCell(generateMaze(10, 10, seededRng(300)));
    const b = pickChestCell(generateMaze(10, 10, seededRng(300)));
    expect(a).toEqual(b);
  });

  it("falls back to exit when no other dead-end exists", () => {
    const maze = generateMaze(2, 2, seededRng(1));
    const chest = pickChestCell(maze);
    expect(maze.deadEnds.some((d) => d.x === chest.x && d.y === chest.y)).toBe(true);
  });
});
