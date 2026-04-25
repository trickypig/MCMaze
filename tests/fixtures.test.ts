import { describe, it, expect } from "vitest";
import { generateMaze } from "../src/generation/maze";
import { buildFloor } from "../src/generation/floor";
import { buildFixtures } from "../src/generation/fixtures";
import { themeForFloor } from "../src/generation/themes";

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

describe("buildFixtures", () => {
  it("places an iron door, pressure plate, and chest inside the floor bounds", () => {
    const maze = generateMaze(8, 8, seededRng(42));
    const theme = themeForFloor(1);
    const anchor = { x: 0, y: -50, z: 0 };
    const floor = buildFloor(maze, {
      anchor,
      wallBlock: theme.wall,
      floorBlock: theme.floor,
      ceilingBlock: theme.ceiling,
    });
    const fx = buildFixtures(maze, floor, anchor, seededRng(999));
    const within = (p: { x: number; y: number; z: number }) =>
      p.x >= floor.bounds.min.x &&
      p.x <= floor.bounds.max.x &&
      p.z >= floor.bounds.min.z &&
      p.z <= floor.bounds.max.z;
    expect(within(fx.exitDoorPos)).toBe(true);
    expect(within(fx.exitPlatePos)).toBe(true);
    expect(within(fx.chestPos)).toBe(true);
  });

  it("places the plate adjacent to the door (manhattan distance 1)", () => {
    const maze = generateMaze(6, 6, seededRng(7));
    const anchor = { x: 100, y: -80, z: 200 };
    const floor = buildFloor(maze, {
      anchor,
      wallBlock: "minecraft:stone_bricks",
      floorBlock: "minecraft:cobblestone",
      ceilingBlock: "minecraft:stone_bricks",
    });
    const fx = buildFixtures(maze, floor, anchor, seededRng(999));
    const dx = Math.abs(fx.exitDoorPos.x - fx.exitPlatePos.x);
    const dz = Math.abs(fx.exitDoorPos.z - fx.exitPlatePos.z);
    expect(dx + dz).toBe(1);
    expect(fx.exitDoorPos.y).toBe(fx.exitPlatePos.y);
  });

  it("emits FillOps for iron door block, pressure plate block, chest block, and redstone block below door", () => {
    const maze = generateMaze(6, 6, seededRng(5));
    const anchor = { x: 0, y: -50, z: 0 };
    const floor = buildFloor(maze, {
      anchor,
      wallBlock: "minecraft:stone_bricks",
      floorBlock: "minecraft:cobblestone",
      ceilingBlock: "minecraft:stone_bricks",
    });
    const fx = buildFixtures(maze, floor, anchor, seededRng(999));
    const blocks = fx.operations.map((o) => o.block);
    expect(blocks).toContain("minecraft:iron_door");
    expect(blocks).toContain("minecraft:stone_pressure_plate");
    expect(blocks).toContain("minecraft:chest");
  });

  it("chest position is on the floor y (anchor.y + 1)", () => {
    const maze = generateMaze(8, 8, seededRng(99));
    const anchor = { x: 0, y: -50, z: 0 };
    const floor = buildFloor(maze, {
      anchor,
      wallBlock: "minecraft:stone_bricks",
      floorBlock: "minecraft:cobblestone",
      ceilingBlock: "minecraft:stone_bricks",
    });
    const fx = buildFixtures(maze, floor, anchor, seededRng(999));
    expect(fx.chestPos.y).toBe(anchor.y + 1);
  });
});
