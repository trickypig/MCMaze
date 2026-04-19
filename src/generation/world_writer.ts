import { world, BlockPermutation, BlockVolume } from "@minecraft/server";
import type { FillOp, Vec3 } from "./floor";

const MAX_VOLUME = 32_768;
const CHUNK_SIZE = 30; // 30^3 = 27,000 < 32,768

export function applyOps(ops: FillOp[]): void {
  const dim = world.getDimension("overworld");
  for (const op of ops) {
    applySingleOp(op, dim);
  }
}

function applySingleOp(
  op: FillOp,
  dim: ReturnType<typeof world.getDimension>,
): void {
  const volume =
    (op.max.x - op.min.x + 1) *
    (op.max.y - op.min.y + 1) *
    (op.max.z - op.min.z + 1);

  if (volume <= MAX_VOLUME) {
    fillOnce(dim, op.min, op.max, op.block);
    return;
  }

  // Chunk into 30-cube tiles.
  for (let x = op.min.x; x <= op.max.x; x += CHUNK_SIZE) {
    for (let y = op.min.y; y <= op.max.y; y += CHUNK_SIZE) {
      for (let z = op.min.z; z <= op.max.z; z += CHUNK_SIZE) {
        const cMin: Vec3 = { x, y, z };
        const cMax: Vec3 = {
          x: Math.min(x + CHUNK_SIZE - 1, op.max.x),
          y: Math.min(y + CHUNK_SIZE - 1, op.max.y),
          z: Math.min(z + CHUNK_SIZE - 1, op.max.z),
        };
        fillOnce(dim, cMin, cMax, op.block);
      }
    }
  }
}

function fillOnce(
  dim: ReturnType<typeof world.getDimension>,
  min: Vec3,
  max: Vec3,
  blockId: string,
): void {
  try {
    const perm = BlockPermutation.resolve(blockId);
    dim.fillBlocks(new BlockVolume(min, max), perm);
  } catch (e) {
    console.warn(
      `[TrickyMaze] fillBlocks failed at (${min.x},${min.y},${min.z})->(${max.x},${max.y},${max.z}) with ${blockId}: ${String(e)}`,
    );
  }
}
