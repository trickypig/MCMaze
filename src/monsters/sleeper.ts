import { system, world, EntityDamageCause, type Entity, type Vector3 } from "@minecraft/server";
import { registerBehavior } from "./registry";
import { getRuntime, setRuntime } from "./state";
import { nearestPlayer, faceToward } from "./helpers";

const DETECT_RANGE = 3;
const CHARGE_STEP = 0.8;
const CHARGE_TICKS = 15;      // 15 × 4gt = 3.0 s
const COOLDOWN_TICKS = 5;     // 5 × 4gt = 1.0 s
const HIT_THROTTLE_TICKS = 3;
const CONTACT_DIST = 1.5;
const BASE_DAMAGE = 4;

type SleepState = { kind: "sleep" };
type ChargeState = {
  kind: "charge";
  targetId: string;
  startTick: number;
  lastHitTick: number;
};
type CooldownState = { kind: "cooldown"; untilTick: number };
type Runtime = SleepState | ChargeState | CooldownState;

type Config = {
  homePoint: Vector3;
  damageMult: number;
};

function readConfig(e: Entity): Config | undefined {
  const hx = e.getDynamicProperty("trickymaze:home_x");
  const hy = e.getDynamicProperty("trickymaze:home_y");
  const hz = e.getDynamicProperty("trickymaze:home_z");
  const dm = e.getDynamicProperty("trickymaze:damage_mult");
  if (
    typeof hx !== "number" || typeof hy !== "number" || typeof hz !== "number" ||
    typeof dm !== "number"
  ) return undefined;
  return { homePoint: { x: hx, y: hy, z: hz }, damageMult: dm };
}

function distance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.hypot(dx, dy, dz);
}

function normalize(v: Vector3): Vector3 {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 0.0001) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function tickSleeper(entity: Entity): void {
  const cfg = readConfig(entity);
  if (!cfg) return;

  let state = getRuntime<Runtime>(entity.id);
  if (!state) {
    state = { kind: "sleep" };
    setRuntime(entity.id, state);
  }

  const now = system.currentTick;

  if (state.kind === "sleep") {
    // Ambush: no LOS, no arc — anyone close wakes us.
    const p = nearestPlayer(entity, DETECT_RANGE);
    if (p) {
      setRuntime<Runtime>(entity.id, {
        kind: "charge",
        targetId: p.id,
        startTick: now,
        lastHitTick: -999,
      });
    }
    return;
  }

  if (state.kind === "cooldown") {
    if (now >= state.untilTick) {
      try { entity.tryTeleport(cfg.homePoint, { checkForBlocks: true }); } catch { /* ignore */ }
      setRuntime<Runtime>(entity.id, { kind: "sleep" });
    }
    return;
  }

  // state.kind === "charge"
  const target = world.getEntity(state.targetId);
  if (!target || !target.isValid || now - state.startTick >= CHARGE_TICKS) {
    setRuntime<Runtime>(entity.id, { kind: "cooldown", untilTick: now + COOLDOWN_TICKS });
    return;
  }

  try { faceToward(entity, target.location); } catch { /* ignore */ }

  const delta: Vector3 = {
    x: target.location.x - entity.location.x,
    y: 0,
    z: target.location.z - entity.location.z,
  };
  const step = normalize(delta);
  try {
    entity.tryTeleport(
      {
        x: entity.location.x + step.x * CHARGE_STEP,
        y: entity.location.y,
        z: entity.location.z + step.z * CHARGE_STEP,
      },
      { checkForBlocks: true, keepVelocity: false },
    );
  } catch { /* ignore */ }

  if (distance(entity.location, target.location) < CONTACT_DIST &&
      now - state.lastHitTick >= HIT_THROTTLE_TICKS) {
    try {
      target.applyDamage(Math.round(BASE_DAMAGE * cfg.damageMult), {
        cause: EntityDamageCause.entityAttack,
        damagingEntity: entity,
      });
    } catch { /* ignore */ }
    state.lastHitTick = now;
  }
}

export function registerSleeper(): void {
  registerBehavior("sleeper", tickSleeper);
}
