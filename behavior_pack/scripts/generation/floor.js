/**
 * Translates a maze into a set of fill operations anchored at `anchor`.
 * Cell (x, y) maps to block region
 *   [anchor.x + 3x .. anchor.x + 3x + 2]
 *   [anchor.z + 3y .. anchor.z + 3y + 2]
 * Walls are 1 block thick on the high edge of each cell and shared with the
 * next cell. A solid outer perimeter is added.
 */
export function buildFloor(maze, cfg) {
    const W = maze.cells.length;
    const H = maze.cells[0].length;
    const sizeX = 3 * W + 1;
    const sizeZ = 3 * H + 1;
    const a = cfg.anchor;
    const ops = [];
    // 1. Clear volume with air.
    ops.push({
        min: { x: a.x, y: a.y, z: a.z },
        max: { x: a.x + sizeX - 1, y: a.y + 4, z: a.z + sizeZ - 1 },
        block: "minecraft:air",
    });
    // 2. Floor layer.
    ops.push({
        min: { x: a.x, y: a.y, z: a.z },
        max: { x: a.x + sizeX - 1, y: a.y, z: a.z + sizeZ - 1 },
        block: cfg.floorBlock,
    });
    // 3. Ceiling layer.
    ops.push({
        min: { x: a.x, y: a.y + 4, z: a.z },
        max: { x: a.x + sizeX - 1, y: a.y + 4, z: a.z + sizeZ - 1 },
        block: cfg.ceilingBlock,
    });
    // 4. Full wall grid (we'll carve passages next).
    // Draw a lattice: every N/S/E/W wall that still stands becomes a block column.
    for (let cx = 0; cx < W; cx++) {
        for (let cy = 0; cy < H; cy++) {
            const cell = maze.cells[cx][cy];
            const ox = a.x + cx * 3;
            const oz = a.z + cy * 3;
            // Corner pillar at (ox, oz)
            ops.push({
                min: { x: ox, y: a.y + 1, z: oz },
                max: { x: ox, y: a.y + 3, z: oz },
                block: cfg.wallBlock,
            });
            // North wall at z = oz, spanning x = ox+1..ox+3 if cell.walls.N
            if (cell.walls.N) {
                ops.push({
                    min: { x: ox + 1, y: a.y + 1, z: oz },
                    max: { x: ox + 3, y: a.y + 3, z: oz },
                    block: cfg.wallBlock,
                });
            }
            // West wall at x = ox, spanning z = oz+1..oz+3 if cell.walls.W
            if (cell.walls.W) {
                ops.push({
                    min: { x: ox, y: a.y + 1, z: oz + 1 },
                    max: { x: ox, y: a.y + 3, z: oz + 3 },
                    block: cfg.wallBlock,
                });
            }
        }
    }
    // Outer south and east walls (the last row/col doesn't emit those from cells).
    ops.push({
        min: { x: a.x, y: a.y + 1, z: a.z + sizeZ - 1 },
        max: { x: a.x + sizeX - 1, y: a.y + 3, z: a.z + sizeZ - 1 },
        block: cfg.wallBlock,
    });
    ops.push({
        min: { x: a.x + sizeX - 1, y: a.y + 1, z: a.z },
        max: { x: a.x + sizeX - 1, y: a.y + 3, z: a.z + sizeZ - 1 },
        block: cfg.wallBlock,
    });
    // Sparse light blocks embedded in the ceiling — dim but navigable.
    // One light every 4 cells on each axis; block_light_level ~7.
    for (let cx = 1; cx < W; cx += 2) {
        for (let cy = 1; cy < H; cy += 2) {
            const lx = a.x + cx * 3 + 2;
            const lz = a.z + cy * 3 + 2;
            ops.push({
                min: { x: lx, y: a.y + 3, z: lz },
                max: { x: lx, y: a.y + 3, z: lz },
                block: "minecraft:light_block",
                blockStates: { block_light_level: 7 },
            });
        }
    }
    // Entrance/exit center coords (on the floor of each cell).
    const entranceBlock = cellCenter(maze.entrance, a);
    const exitBlock = cellCenter(maze.exit, a);
    return {
        operations: ops,
        bounds: {
            min: { x: a.x, y: a.y, z: a.z },
            max: { x: a.x + sizeX - 1, y: a.y + 4, z: a.z + sizeZ - 1 },
        },
        entranceBlock,
        exitBlock,
    };
}
function cellCenter(cell, anchor) {
    return {
        x: anchor.x + cell.x * 3 + 2,
        y: anchor.y + 1,
        z: anchor.z + cell.y * 3 + 2,
    };
}
