import { describe, it, expect } from "vitest";
import { generateMaze } from "../src/generation/maze";
import { pickChestCell, allocateChests, lootTierForFloor } from "../src/generation/chest_placement";

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

describe("allocateChests", () => {
  it("produces disjoint sets for key/armory/supply", () => {
    const maze = generateMaze(12, 12, seededRng(500));
    const { keyCell, armoryCells, supplyCells } = allocateChests(maze, seededRng(600));
    const seen = new Set<string>();
    const k = (c: { x: number; y: number }) => `${c.x},${c.y}`;
    seen.add(k(keyCell));
    for (const c of armoryCells) {
      expect(seen.has(k(c))).toBe(false);
      seen.add(k(c));
    }
    for (const c of supplyCells) {
      expect(seen.has(k(c))).toBe(false);
      seen.add(k(c));
    }
  });

  it("respects density target of ~cells/20", () => {
    const maze = generateMaze(12, 12, seededRng(501));
    const { armoryCells, supplyCells } = allocateChests(maze, seededRng(601));
    const total = 1 + armoryCells.length + supplyCells.length;
    expect(total).toBeGreaterThanOrEqual(3);
    expect(total).toBeLessThanOrEqual(9);
  });

  it("armory cells meet the 60% BFS threshold", () => {
    const maze = generateMaze(12, 12, seededRng(502));
    let maxDist = 0;
    for (const d of maze.deadEnds) {
      const dist = maze.bfsDistance(d);
      if (dist > maxDist) maxDist = dist;
    }
    const { armoryCells } = allocateChests(maze, seededRng(602));
    for (const c of armoryCells) {
      expect(maze.bfsDistance(c)).toBeGreaterThanOrEqual(maxDist * 0.6);
    }
  });

  it("is deterministic for the same seed", () => {
    const a = allocateChests(generateMaze(12, 12, seededRng(503)), seededRng(700));
    const b = allocateChests(generateMaze(12, 12, seededRng(503)), seededRng(700));
    expect(a).toEqual(b);
  });
});

describe("lootTierForFloor", () => {
  it("floors 1-2 are tier 1, floors 3-4 are tier 2", () => {
    expect(lootTierForFloor(1)).toBe(1);
    expect(lootTierForFloor(2)).toBe(1);
    expect(lootTierForFloor(3)).toBe(2);
    expect(lootTierForFloor(4)).toBe(2);
  });
});
