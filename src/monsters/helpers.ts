import { world, type Entity, type Player, type Vector3 } from "@minecraft/server";

export function nearestPlayer(entity: Entity, maxDist: number): Player | undefined {
  const dim = entity.dimension;
  const players = dim.getPlayers({
    location: entity.location,
    maxDistance: maxDist,
  });
  if (players.length === 0) return undefined;
  let best: Player | undefined;
  let bestSq = Infinity;
  for (const p of players) {
    const dx = p.location.x - entity.location.x;
    const dy = p.location.y - entity.location.y;
    const dz = p.location.z - entity.location.z;
    const sq = dx * dx + dy * dy + dz * dz;
    if (sq < bestSq) {
      bestSq = sq;
      best = p;
    }
  }
  return best;
}

export function isInFrontOf(
  entity: Entity,
  target: { location: Vector3 },
  arcDeg: number,
): boolean {
  const view = entity.getViewDirection();
  const dx = target.location.x - entity.location.x;
  const dz = target.location.z - entity.location.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.001) return true;
  const ux = dx / len;
  const uz = dz / len;
  // Flatten entity view direction onto XZ.
  const vlen = Math.hypot(view.x, view.z);
  if (vlen < 0.001) return false;
  const vx = view.x / vlen;
  const vz = view.z / vlen;
  const dot = ux * vx + uz * vz;
  const threshold = Math.cos((arcDeg / 2) * (Math.PI / 180));
  return dot >= threshold;
}

export function hasLineOfSight(entity: Entity, target: Player): boolean {
  const hit = entity.getBlockFromViewDirection({ maxDistance: 6 });
  if (!hit) return true;
  const dx = hit.block.location.x - entity.location.x;
  const dy = hit.block.location.y - entity.location.y;
  const dz = hit.block.location.z - entity.location.z;
  const blockDist = Math.hypot(dx, dy, dz);
  const tx = target.location.x - entity.location.x;
  const ty = target.location.y - entity.location.y;
  const tz = target.location.z - entity.location.z;
  const playerDist = Math.hypot(tx, ty, tz);
  return playerDist <= blockDist;
}

export function faceToward(entity: Entity, target: Vector3): void {
  const dx = target.x - entity.location.x;
  const dz = target.z - entity.location.z;
  const yaw = (Math.atan2(-dx, dz) * 180) / Math.PI;
  entity.setRotation({ x: 0, y: yaw });
}

export function axisVector(axis: "N" | "S" | "E" | "W"): Vector3 {
  switch (axis) {
    case "N": return { x: 0, y: 0, z: -1 };
    case "S": return { x: 0, y: 0, z: 1 };
    case "E": return { x: 1, y: 0, z: 0 };
    case "W": return { x: -1, y: 0, z: 0 };
  }
}

// Unused `world` re-export placeholder so that future helpers needing the
// world reference don't need a separate import in callers. Keep the import
// in case TS tree-shakes; see commits for context.
export { world };
