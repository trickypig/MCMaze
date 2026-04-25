/**
 * Builds a 7x7x5 prison room at `anchor` (min corner).
 * Interior is 5x5x3. North wall (low-z edge) has an iron door with a
 * pressure plate one block inside the room.
 */
export function buildPrison(anchor) {
    const a = anchor;
    const ops = [];
    // Hollow cube: fill solid then carve interior.
    ops.push({
        min: { x: a.x, y: a.y, z: a.z },
        max: { x: a.x + 6, y: a.y + 4, z: a.z + 6 },
        block: "minecraft:stone_bricks",
    });
    ops.push({
        min: { x: a.x + 1, y: a.y + 1, z: a.z + 1 },
        max: { x: a.x + 5, y: a.y + 3, z: a.z + 5 },
        block: "minecraft:air",
    });
    // Floor = stone bricks (already there from solid fill).
    // Iron bar windows (east + west walls, middle of the wall).
    ops.push({
        min: { x: a.x, y: a.y + 2, z: a.z + 3 },
        max: { x: a.x, y: a.y + 2, z: a.z + 3 },
        block: "minecraft:iron_bars",
    });
    ops.push({
        min: { x: a.x + 6, y: a.y + 2, z: a.z + 3 },
        max: { x: a.x + 6, y: a.y + 2, z: a.z + 3 },
        block: "minecraft:iron_bars",
    });
    // Door opening on north wall (low-z edge) at x = a.x + 3.
    const doorX = a.x + 3;
    const doorZ = a.z;
    // Carve 2-tall opening.
    ops.push({
        min: { x: doorX, y: a.y + 1, z: doorZ },
        max: { x: doorX, y: a.y + 2, z: doorZ },
        block: "minecraft:air",
    });
    // Bedrock does not auto-place the upper half — set both with explicit states.
    ops.push({
        min: { x: doorX, y: a.y + 1, z: doorZ },
        max: { x: doorX, y: a.y + 1, z: doorZ },
        block: "minecraft:iron_door",
        blockStates: { direction: 3, open_bit: false, upper_block_bit: false },
    });
    ops.push({
        min: { x: doorX, y: a.y + 2, z: doorZ },
        max: { x: doorX, y: a.y + 2, z: doorZ },
        block: "minecraft:iron_door",
        blockStates: { direction: 3, open_bit: false, upper_block_bit: true, door_hinge_bit: false },
    });
    // Pressure plate one block inside the door.
    const plateX = a.x + 3;
    const plateY = a.y + 1;
    const plateZ = a.z + 1;
    ops.push({
        min: { x: plateX, y: plateY, z: plateZ },
        max: { x: plateX, y: plateY, z: plateZ },
        block: "minecraft:heavy_weighted_pressure_plate",
    });
    // One dim light block in the ceiling center so the cell isn't pitch black.
    ops.push({
        min: { x: a.x + 3, y: a.y + 3, z: a.z + 3 },
        max: { x: a.x + 3, y: a.y + 3, z: a.z + 3 },
        block: "minecraft:light_block",
        blockStates: { block_light_level: 7 },
    });
    // Spawn in center of room, facing north.
    const spawnPos = { x: a.x + 3, y: a.y + 1, z: a.z + 3 };
    return {
        operations: ops,
        bounds: {
            min: { x: a.x, y: a.y, z: a.z },
            max: { x: a.x + 6, y: a.y + 4, z: a.z + 6 },
        },
        spawnPos,
        doorPos: { x: doorX, y: a.y + 1, z: doorZ },
        pressurePlatePos: { x: plateX, y: plateY, z: plateZ },
    };
}
