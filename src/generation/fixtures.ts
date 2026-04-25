import type { Coord, Maze } from "./maze";
import type { FillOp, FloorSpec, Vec3 } from "./floor";
import { allocateChests } from "./chest_placement";

export interface FloorFixtures {
  exitDoorPos: Vec3;
  exitPlatePos: Vec3;
  chestPos: Vec3;
  armoryChestPositions: Vec3[];
  supplyChestPositions: Vec3[];
  operations: FillOp[];
}

/**
 * Compute fixture positions (door, plate, chest) for a generated maze floor
 * and return the FillOps needed to place them. The `buildFloor` operations
 * should be applied first; these fixture ops overwrite specific cells.
 *
 * Door placement: the exit cell's center (entranceBlock/exitBlock coords are
 * the block-space centers of those cells). Plate is placed one block toward
 * the entrance along whichever axis separates the exit cell from its
 * single open neighbor. A redstone block is placed directly below the door
 * to power it open when fixture ops apply (Task 12 will swap it in only
 * after the key is consumed — at build time we place the door closed and a
 * non-redstone block below).
 */
export function buildFixtures(
  maze: Maze,
  floor: FloorSpec,
  anchor: Vec3,
  rng: () => number,
): FloorFixtures {
  const doorCell = maze.exit;
  const doorPos: Vec3 = cellCenter(doorCell, anchor);

  // Find the single open neighbor of the exit cell; plate goes toward it.
  const walls = maze.cells[doorCell.x][doorCell.y].walls;
  const openNeighborOffset = (() => {
    if (!walls.N) return { dx: 0, dz: -3 };
    if (!walls.S) return { dx: 0, dz: 3 };
    if (!walls.E) return { dx: 3, dz: 0 };
    if (!walls.W) return { dx: -3, dz: 0 };
    return { dx: 0, dz: -3 };
  })();
  // Plate: one block from door along the passage direction.
  const platePos: Vec3 = {
    x: doorPos.x + Math.sign(openNeighborOffset.dx),
    y: doorPos.y,
    z: doorPos.z + Math.sign(openNeighborOffset.dz),
  };

  const allocation = allocateChests(maze, rng);
  const chestPos: Vec3 = cellCenter(allocation.keyCell, anchor);
  const armoryChestPositions = allocation.armoryCells.map((c) => cellCenter(c, anchor));
  const supplyChestPositions = allocation.supplyCells.map((c) => cellCenter(c, anchor));

  const ops: FillOp[] = [
    // Clear the door cell's air column (in case carver left walls).
    {
      min: { x: doorPos.x, y: doorPos.y, z: doorPos.z },
      max: { x: doorPos.x, y: doorPos.y + 1, z: doorPos.z },
      block: "minecraft:air",
    },
    // Iron door — both halves placed closed. Bedrock does not auto-place the upper half.
    {
      min: { x: doorPos.x, y: doorPos.y, z: doorPos.z },
      max: { x: doorPos.x, y: doorPos.y, z: doorPos.z },
      block: "minecraft:iron_door",
      blockStates: { direction: 0, open_bit: false, upper_block_bit: false },
    },
    {
      min: { x: doorPos.x, y: doorPos.y + 1, z: doorPos.z },
      max: { x: doorPos.x, y: doorPos.y + 1, z: doorPos.z },
      block: "minecraft:iron_door",
      blockStates: { direction: 0, open_bit: false, upper_block_bit: true, door_hinge_bit: false },
    },
    // Pressure plate one block away toward the passage.
    {
      min: { x: platePos.x, y: platePos.y, z: platePos.z },
      max: { x: platePos.x, y: platePos.y, z: platePos.z },
      block: "minecraft:stone_pressure_plate",
    },
    // Key chest at the farthest dead-end.
    {
      min: { x: chestPos.x, y: chestPos.y, z: chestPos.z },
      max: { x: chestPos.x, y: chestPos.y, z: chestPos.z },
      block: "minecraft:chest",
    },
  ];

  // Entrance marker: two-block ladder hung on the inside face of the entrance
  // cell's north wall — runs from walkable height up into the ceiling so it
  // reads as descending from above.
  const entrance = floor.entranceBlock;
  const ladderPos: Vec3 = { x: entrance.x, y: entrance.y + 1, z: entrance.z - 1 };
  ops.push({
    min: { x: ladderPos.x, y: ladderPos.y, z: ladderPos.z },
    max: { x: ladderPos.x, y: ladderPos.y + 1, z: ladderPos.z },
    block: "minecraft:ladder",
    blockStates: { facing_direction: 3 },
  });

  for (const p of armoryChestPositions) {
    ops.push({
      min: { x: p.x, y: p.y, z: p.z },
      max: { x: p.x, y: p.y, z: p.z },
      block: "minecraft:chest",
    });
  }
  for (const p of supplyChestPositions) {
    ops.push({
      min: { x: p.x, y: p.y, z: p.z },
      max: { x: p.x, y: p.y, z: p.z },
      block: "minecraft:chest",
    });
  }

  return {
    exitDoorPos: doorPos,
    exitPlatePos: platePos,
    chestPos,
    armoryChestPositions,
    supplyChestPositions,
    operations: ops,
  };
}

function cellCenter(cell: Coord, anchor: Vec3): Vec3 {
  return {
    x: anchor.x + cell.x * 3 + 2,
    y: anchor.y + 1,
    z: anchor.z + cell.y * 3 + 2,
  };
}
