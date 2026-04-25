import { system, type Entity, type Vector3 } from "@minecraft/server";
import { registerBehavior } from "./registry";
import { getRuntime, setRuntime } from "./state";
import { nearestPlayer, hasLineOfSight, faceToward } from "./helpers";

const DETECT_RANGE = 16;
const SHOOT_INTERVAL_GT = 40;     // game ticks (vanilla)
const SCHEDULER_PERIOD_GT = 4;    // matches scheduler.ts TICK_INTERVAL
const SHOOT_INTERVAL_TICKS = SHOOT_INTERVAL_GT / SCHEDULER_PERIOD_GT; // 10
const ARROW_SPEED = 1.6;
const EYE_HEIGHT = 1.5;

type Runtime = { lastShotTick: number };

export function tickSentryArcher(entity: Entity): void {
  let state = getRuntime<Runtime>(entity.id);
  if (!state) {
    state = { lastShotTick: -SHOOT_INTERVAL_TICKS };
    setRuntime(entity.id, state);
  }

  const target = nearestPlayer(entity, DETECT_RANGE);
  if (!target) return;
  if (!hasLineOfSight(entity, target)) return;

  try { faceToward(entity, target.location); } catch { /* ignore */ }

  const now = system.currentTick;
  if (now - state.lastShotTick < SHOOT_INTERVAL_TICKS) return;

  const origin: Vector3 = {
    x: entity.location.x,
    y: entity.location.y + EYE_HEIGHT,
    z: entity.location.z,
  };
  const dx = target.location.x - origin.x;
  const dy = target.location.y + EYE_HEIGHT * 0.7 - origin.y;
  const dz = target.location.z - origin.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.001) return;
  const dir: Vector3 = { x: dx / len, y: dy / len, z: dz / len };

  // Spawn arrow slightly in front of the archer's eye and give it velocity.
  const spawnPos: Vector3 = {
    x: origin.x + dir.x * 0.5,
    y: origin.y + dir.y * 0.5,
    z: origin.z + dir.z * 0.5,
  };

  try {
    const arrow = entity.dimension.spawnEntity("minecraft:arrow", spawnPos);
    arrow.clearVelocity();
    arrow.applyImpulse({
      x: dir.x * ARROW_SPEED,
      y: dir.y * ARROW_SPEED,
      z: dir.z * ARROW_SPEED,
    });
  } catch { /* spawn failed — try again next interval */ }

  state.lastShotTick = now;
}

export function registerSentryArcher(): void {
  registerBehavior("sentry_archer", tickSentryArcher);
}
