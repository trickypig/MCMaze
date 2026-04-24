import { system, world, EntityDamageCause, type Entity, type Vector3 } from "@minecraft/server";
import { registerBehavior } from "./registry";
import { getRuntime, setRuntime } from "./state";
import { nearestPlayer, isInFrontOf, hasLineOfSight, faceToward, axisVector } from "./helpers";

const IMPULSE_MAG = 0.35;
const CHARGE_STEP = 0.8;
const DETECT_RANGE = 5;
const FRONTAL_ARC_DEG = 90;
const CHARGE_TICKS = 15;      // 15 × 4gt = 3.0 s
const COOLDOWN_TICKS = 5;     // 5 × 4gt = 1.0 s
const HIT_THROTTLE_TICKS = 3; // 3 × 4gt ≈ 600 ms
const STUCK_TICK_LIMIT = 3;
const CONTACT_DIST = 1.5;
const BASE_DAMAGE = 4;

type Axis = "N" | "S" | "E" | "W";

type PatrolState = {
  kind: "patrol";
  dir: 1 | -1;
  stuckTicks: number;
  lastPos: Vector3;
};
type ChargeState = {
  kind: "charge";
  targetId: string;
  startTick: number;
  lastHitTick: number;
  dir: 1 | -1;
};
type CooldownState = {
  kind: "cooldown";
  untilTick: number;
  dir: 1 | -1;
  stuckTicks: number;
  lastPos: Vector3;
};
type Runtime = PatrolState | ChargeState | CooldownState;

type Config = {
  homePoint: Vector3;
  patrolAxis: Axis;
  patrolLength: number;
  damageMult: number;
};

function readConfig(e: Entity): Config | undefined {
  const hx = e.getDynamicProperty("trickymaze:home_x");
  const hy = e.getDynamicProperty("trickymaze:home_y");
  const hz = e.getDynamicProperty("trickymaze:home_z");
  const ax = e.getDynamicProperty("trickymaze:patrol_axis");
  const ln = e.getDynamicProperty("trickymaze:patrol_length");
  const dm = e.getDynamicProperty("trickymaze:damage_mult");
  if (
    typeof hx !== "number" || typeof hy !== "number" || typeof hz !== "number" ||
    typeof ax !== "string" || typeof ln !== "number" || typeof dm !== "number"
  ) return undefined;
  return {
    homePoint: { x: hx, y: hy, z: hz },
    patrolAxis: ax as Axis,
    patrolLength: ln,
    damageMult: dm,
  };
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

function tickPatroller(entity: Entity): void {
  const cfg = readConfig(entity);
  if (!cfg) return;

  let state = getRuntime<Runtime>(entity.id);
  if (!state) {
    state = {
      kind: "patrol",
      dir: 1,
      stuckTicks: 0,
      lastPos: { ...entity.location },
    };
    setRuntime(entity.id, state);
  }

  const now = system.currentTick;
  const axis = axisVector(cfg.patrolAxis);

  if (state.kind === "patrol" || state.kind === "cooldown") {
    // Movement: walk toward turn-around point.
    const halfLen = cfg.patrolLength / 2 - 0.5;
    const target: Vector3 = {
      x: cfg.homePoint.x + axis.x * state.dir * halfLen,
      y: entity.location.y,
      z: cfg.homePoint.z + axis.z * state.dir * halfLen,
    };
    try {
      entity.applyImpulse({
        x: axis.x * state.dir * IMPULSE_MAG,
        y: 0,
        z: axis.z * state.dir * IMPULSE_MAG,
      });
    } catch { /* entity may have been removed */ }

    if (distance(entity.location, target) < 0.6) {
      state.dir = (state.dir === 1 ? -1 : 1) as 1 | -1;
    }

    // Stuck detection.
    const moved = distance(entity.location, state.lastPos);
    if (moved < 0.1) {
      state.stuckTicks += 1;
      if (state.stuckTicks > STUCK_TICK_LIMIT) {
        try {
          entity.tryTeleport(cfg.homePoint, { checkForBlocks: true });
        } catch { /* ignore */ }
        state.stuckTicks = 0;
      }
    } else {
      state.stuckTicks = 0;
    }
    state.lastPos = { ...entity.location };

    if (state.kind === "cooldown") {
      if (now >= state.untilTick) {
        setRuntime<Runtime>(entity.id, {
          kind: "patrol",
          dir: state.dir,
          stuckTicks: 0,
          lastPos: { ...entity.location },
        });
      }
      return;
    }

    // Aggro check (patrol only).
    const p = nearestPlayer(entity, DETECT_RANGE);
    if (p && isInFrontOf(entity, p, FRONTAL_ARC_DEG) && hasLineOfSight(entity, p)) {
      setRuntime<Runtime>(entity.id, {
        kind: "charge",
        targetId: p.id,
        startTick: now,
        lastHitTick: -999,
        dir: state.dir,
      });
    }
    return;
  }

  // state.kind === "charge"
  const target = world.getEntity(state.targetId);
  if (!target || !target.isValid || now - state.startTick >= CHARGE_TICKS) {
    setRuntime<Runtime>(entity.id, {
      kind: "cooldown",
      untilTick: now + COOLDOWN_TICKS,
      dir: state.dir,
      stuckTicks: 0,
      lastPos: { ...entity.location },
    });
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

export function registerPatroller(): void {
  registerBehavior("patroller", tickPatroller);
}
