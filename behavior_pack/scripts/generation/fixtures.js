import { pickChestCell } from "./chest_placement";
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
export function buildFixtures(maze, floor, anchor) {
    const doorCell = maze.exit;
    const doorPos = cellCenter(doorCell, anchor);
    // Find the single open neighbor of the exit cell; plate goes toward it.
    const walls = maze.cells[doorCell.x][doorCell.y].walls;
    const openNeighborOffset = (() => {
        if (!walls.N)
            return { dx: 0, dz: -3 };
        if (!walls.S)
            return { dx: 0, dz: 3 };
        if (!walls.E)
            return { dx: 3, dz: 0 };
        if (!walls.W)
            return { dx: -3, dz: 0 };
        return { dx: 0, dz: -3 };
    })();
    // Plate: one block from door along the passage direction.
    const platePos = {
        x: doorPos.x + Math.sign(openNeighborOffset.dx),
        y: doorPos.y,
        z: doorPos.z + Math.sign(openNeighborOffset.dz),
    };
    const chestCell = pickChestCell(maze);
    const chestPos = cellCenter(chestCell, anchor);
    const ops = [
        // Clear the door cell's air column (in case carver left walls).
        {
            min: { x: doorPos.x, y: doorPos.y, z: doorPos.z },
            max: { x: doorPos.x, y: doorPos.y + 1, z: doorPos.z },
            block: "minecraft:air",
        },
        // Iron door (lower half). Upper half auto-placed by Bedrock.
        {
            min: { x: doorPos.x, y: doorPos.y, z: doorPos.z },
            max: { x: doorPos.x, y: doorPos.y, z: doorPos.z },
            block: "minecraft:iron_door",
        },
        // Pressure plate one block away toward the passage.
        {
            min: { x: platePos.x, y: platePos.y, z: platePos.z },
            max: { x: platePos.x, y: platePos.y, z: platePos.z },
            block: "minecraft:stone_pressure_plate",
        },
        // Chest at the chosen dead-end cell's center.
        {
            min: { x: chestPos.x, y: chestPos.y, z: chestPos.z },
            max: { x: chestPos.x, y: chestPos.y, z: chestPos.z },
            block: "minecraft:chest",
        },
    ];
    return {
        exitDoorPos: doorPos,
        exitPlatePos: platePos,
        chestPos,
        operations: ops,
    };
}
function cellCenter(cell, anchor) {
    return {
        x: anchor.x + cell.x * 3 + 2,
        y: anchor.y + 1,
        z: anchor.z + cell.y * 3 + 2,
    };
}
