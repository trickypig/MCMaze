import { world, BlockPermutation, BlockVolume } from "@minecraft/server";
const MAX_VOLUME = 32_768;
const CHUNK_SIZE = 30; // 30^3 = 27,000 < 32,768
const WORLD_MIN_Y = -64;
const WORLD_MAX_Y = 320;
export function applyOps(ops) {
    const dim = world.getDimension("overworld");
    for (const op of ops) {
        if (op.min.y < WORLD_MIN_Y || op.max.y > WORLD_MAX_Y) {
            console.warn(`[TrickyMaze] Skipping op at y=${op.min.y}..${op.max.y} — outside world bounds [${WORLD_MIN_Y}, ${WORLD_MAX_Y}]`);
            continue;
        }
        applySingleOp(op, dim);
    }
}
function applySingleOp(op, dim) {
    const volume = (op.max.x - op.min.x + 1) *
        (op.max.y - op.min.y + 1) *
        (op.max.z - op.min.z + 1);
    if (volume <= MAX_VOLUME) {
        fillOnce(dim, op.min, op.max, op.block, op.blockStates);
        return;
    }
    // Chunk into 30-cube tiles.
    for (let x = op.min.x; x <= op.max.x; x += CHUNK_SIZE) {
        for (let y = op.min.y; y <= op.max.y; y += CHUNK_SIZE) {
            for (let z = op.min.z; z <= op.max.z; z += CHUNK_SIZE) {
                const cMin = { x, y, z };
                const cMax = {
                    x: Math.min(x + CHUNK_SIZE - 1, op.max.x),
                    y: Math.min(y + CHUNK_SIZE - 1, op.max.y),
                    z: Math.min(z + CHUNK_SIZE - 1, op.max.z),
                };
                fillOnce(dim, cMin, cMax, op.block, op.blockStates);
            }
        }
    }
}
function fillOnce(dim, min, max, blockId, blockStates) {
    try {
        const perm = blockStates
            ? BlockPermutation.resolve(blockId, blockStates)
            : BlockPermutation.resolve(blockId);
        dim.fillBlocks(new BlockVolume(min, max), perm);
    }
    catch (e) {
        console.warn(`[TrickyMaze] fillBlocks failed at (${min.x},${min.y},${min.z})->(${max.x},${max.y},${max.z}) with ${blockId}: ${String(e)}`);
    }
}
