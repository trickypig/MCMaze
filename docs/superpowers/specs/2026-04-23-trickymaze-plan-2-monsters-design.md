# TrickyMaze Plan 2 — Monster System (Floor 1 slice)

**Date:** 2026-04-23
**Status:** Draft — awaiting user review before implementation planning.
**Parent spec:** `docs/superpowers/specs/2026-04-19-trickymaze-design.md` (§5).
**Predecessor plan:** `docs/superpowers/plans/2026-04-19-trickymaze-plan-1-foundation.md` (merged).

---

## 1. Scope

Floor 1 of TrickyMaze currently generates an empty maze. This plan adds the first
monster: the **Patroller**, the only behavior unlocked on L1 per parent spec §5.6.

**In scope:**

- Shared tick scheduler + behavior registry (reusable by future behaviors).
- Custom entity `trickymaze:patroller_zombie` — stripped of vanilla AI, driven
  entirely by script.
- Pure spawn-manifest generator (maze → list of spawn entries).
- Impure spawner (manifest → live entities with stat scaling).
- Patroller tick behavior: patrol along a corridor axis; charge players in a
  frontal 90° arc within 5 blocks; break after 3 s; ignore flanking/trailing
  players.
- Theme→entity-id lookup table (only `patroller/old_prison` populated).
- Stat-scaling helpers (floor → hp/damage multiplier).
- HUD mob counter using the `trickymaze` family scan.
- Rename of existing `wither_*.json` files to the final naming scheme; they
  remain unregistered and dormant.

**Out of scope (deferred to later plans):**

- Sentry Archer, Sleeper, Stalker, Lurker, Charger, Executioner.
- Theme variants beyond `old_prison` (i.e., L3+ base-mob swaps).
- Custom monster sounds / death effects.
- Multi-floor progression changes.

---

## 2. Architecture

### 2.1 New modules

```
src/
  monsters/
    registry.ts     # behavior registration API
    scheduler.ts    # system.runInterval wrapper + one family-wide scan per tick
    state.ts        # in-memory runtime-state Map keyed by entity.id
    helpers.ts      # nearestPlayer, isInFrontOf, hasLineOfSight, faceToward
    patroller.ts    # Patroller tick + config shape
    themes.ts       # (behavior, theme) -> entity identifier
    stats.ts        # floor -> hp/damage multiplier
    spawner.ts      # consumes SpawnManifest, spawns + configures entities
  generation/
    spawn_plan.ts   # NEW: pure maze analysis -> SpawnManifestEntry[]
```

### 2.2 Module boundaries

- `generation/spawn_plan.ts` has **no `@minecraft/server` imports** — pure and
  unit-testable like `maze.ts` and `floor.ts`.
- `monsters/` is the impure ring. Only `scheduler.ts` calls `system.runInterval`
  for monster AI. Only `spawner.ts` calls `dimension.spawnEntity`. Behaviors
  (`patroller.ts`) only implement tick functions and register themselves.
- `main.ts` gains one side-effect import (`import "./monsters/registry"`) to
  start the tick loop, and the Floor 1 build flow calls
  `spawner.spawnFromManifest(...)` after block placement completes.
- The Floor 1 build flow is already triggered from `events/pressure_plate.ts`
  (Plan 1). That call site threads the `Maze` through to `spawn_plan` and the
  resulting manifest through to `spawner`.

### 2.3 Integration with existing code

`generation/floor.ts` currently consumes a `Maze` and emits block fills. We add
a pure step: `buildSpawnManifest(maze, floor, rng)` called after block placement
by the caller. If `floor.ts` currently discards the `Maze` object after block
placement, the plan includes a small refactor to return or pass it onward so
the spawner can use it.

---

## 3. Behavior state model (Approach 3: hybrid)

Per-entity data lives in two places:

- **Persistent config on dynamic properties.** Set once at spawn by the
  spawner. Reload-safe. Examples: `trickymaze:behavior`, `trickymaze:home_x/y/z`,
  `trickymaze:patrol_axis`, `trickymaze:patrol_length`, `trickymaze:damage_mult`.
- **Ephemeral runtime state in-memory.** A module-level
  `Map<entityId, BehaviorRuntime>` in `monsters/state.ts`. Examples for
  Patroller: current patrol direction, charge start tick, stuck counter,
  charge target id. On script reload, the map starts empty; the first tick
  for an entity re-initializes to a sensible default (patrol, direction +1,
  stuck 0). A mid-charge Patroller goes back to patrol after reload — acceptable.

This is the deliberate design split. If a future behavior needs *truly*
persistent runtime state (e.g., Sleeper's "berserk-until" timestamp), it
promotes that field to a dynamic property.

**Cleanup:** `world.afterEvents.entityRemove` and `entityDie` delete the runtime
state entry for any `trickymaze`-family entity to keep the map bounded.

---

## 4. Entity JSON

### 4.1 Behavior pack

`behavior_pack/entities/patroller_zombie.behavior.json`:

```jsonc
{
  "format_version": "1.21.0",
  "minecraft:entity": {
    "description": {
      "identifier": "trickymaze:patroller_zombie",
      "is_spawnable": false,
      "is_summonable": true,
      "is_experimental": false
    },
    "components": {
      "minecraft:type_family":   { "family": ["trickymaze", "trickymaze_patroller", "monster", "mob"] },
      "minecraft:health":        { "value": 20, "max": 20 },
      "minecraft:physics":       {},
      "minecraft:pushable":      { "is_pushable": true, "is_pushable_by_piston": true },
      "minecraft:breathable":    { "total_supply": 15, "suffocate_time": 0 },
      "minecraft:collision_box": { "width": 0.6, "height": 1.9 },
      "minecraft:movement":      { "value": 0.23 },
      "minecraft:movement.basic":   {},
      "minecraft:navigation.walk":  { "can_path_over_water": false, "avoid_sun": false },
      "minecraft:jump.static":   {},
      "minecraft:knockback_resistance": { "value": 0.0 },
      "minecraft:damage_sensor": {
        "triggers": [
          { "cause": "fall",        "deals_damage": false },
          { "cause": "suffocation", "deals_damage": false }
        ]
      },
      "minecraft:loot": { "table": "loot_tables/empty.json" }
    }
  }
}
```

Deliberately absent: all `minecraft:behavior.*` goals,
`minecraft:behavior.hurt_by_target`, `minecraft:behavior.nearest_attackable_target`,
`minecraft:behavior.melee_attack`. Those are replaced by our tick function.

`movement.basic` + `navigation.walk` are kept so the physics/movement graph is
wired up — `applyImpulse` requires them. We never call the navigation API
ourselves; those components only keep the entity grounded and step-capable.

Knockback resistance is `0.0` so sword knockback works normally (preserves
vanilla combat feel).

`minecraft:loot` points to an empty table — patrollers drop nothing. Loot comes
from chests.

Despawn on descent is handled by the spawner calling `entity.remove()`
directly, not via a despawn component.

### 4.2 Resource pack

`resource_pack/entity/patroller_zombie.entity.json` points at vanilla zombie
geometry and texture (`geometry.zombie`,
`textures/entity/zombie/zombie`). No custom model in Plan 2 — visuals match a
regular zombie. A tint or name-tag differentiator can be added later; it's not
on the critical path for proving AI.

### 4.3 Empty loot table

`behavior_pack/loot_tables/empty.json`:

```json
{ "pools": [] }
```

Reused by any future monster whose corpse shouldn't drop anything.

### 4.4 Dormant wither_*.json renames

These existing files are renamed to match the final naming scheme and left
unregistered:

- `wither_patroller.behavior.json`  → `patroller_wither_skeleton.behavior.json`
- `wither_sleeper.behavior.json`    → `sleeper_wither_skeleton.behavior.json`
- `wither_lurker.behavior.json`     → `lurker_wither_skeleton.behavior.json`

Their identifiers inside the JSON are updated to
`trickymaze:patroller_wither_skeleton`, etc. Matching resource-pack
`wither_*.entity.json` files and `models/wither_*.geo.bbmodel` files are
renamed in lockstep. Nothing registers them yet; they load but never spawn.

---

## 5. Spawn planning and spawning

### 5.1 SpawnManifestEntry shape (`generation/spawn_plan.ts`)

```ts
export type SpawnManifestEntry = {
  behavior: "patroller";
  theme: "old_prison";
  pos: { x: number; y: number; z: number };
  config: {
    homePoint: { x: number; y: number; z: number };
    patrolAxis: "N" | "S" | "E" | "W";
    patrolLength: number;
  };
};

export function buildSpawnManifest(
  maze: Maze, floor: number, rng: () => number
): SpawnManifestEntry[];
```

Positions are **maze-local block coordinates** (not world). The spawner adds
the floor anchor when spawning.

### 5.2 Algorithm (Patroller-only on L1)

1. Find all **maximal straight runs** in the maze graph: sequences of cells
   where each interior cell's open-wall pattern keeps the axis aligned (only
   N↔S or only E↔W through-connections).
2. Discard runs shorter than 4 cells (parent spec §5.8: "straight corridors
   ≥ 4 cells long").
3. For each surviving run, compute:
   - `homePoint` = block-center of the run's midpoint cell at floor-surface Y.
   - `patrolAxis` = run orientation.
   - `patrolLength` = cellCount × 3 (each cell is 3 blocks).
4. Exclude runs that contain the entrance cell or exit cell (no ambush at
   spawn/descent).
5. Target count: `max(1, floor(totalCells / 12))`. For a 12×12 L1 (144 cells),
   that's 12 patrollers.
6. If eligible runs exceed target, shuffle with the seeded RNG and take N.
   If fewer, take all and `console.warn` the shortfall.
7. Emit one entry per chosen run.

### 5.3 Spawner (`monsters/spawner.ts`)

```ts
export function spawnFromManifest(
  dim: Dimension,
  anchor: Vector3,
  manifest: SpawnManifestEntry[],
  floor: number,
): number;
```

For each entry:

1. Resolve identifier: `resolveEntityId("patroller", "old_prison")` →
   `"trickymaze:patroller_zombie"`.
2. Compute world position: `anchor + pos`.
3. `dim.spawnEntity(identifier, worldPos)` → `entity | undefined`. On
   undefined, `console.warn` with the manifest entry and continue.
4. Write dynamic properties:
   - `trickymaze:behavior = "patroller"`
   - `trickymaze:home_x/y/z` = config.homePoint components
   - `trickymaze:patrol_axis` = config.patrolAxis
   - `trickymaze:patrol_length` = config.patrolLength
   - `trickymaze:damage_mult` = `damageMultiplier(floor)`
5. Apply stat scaling to health: set both `max` and `current` to
   `20 * healthMultiplier(floor)` via
   `entity.getComponent("minecraft:health")`.
6. Return count actually spawned.

### 5.4 Despawn on descent / reset

Descent (not implemented in Plan 2 but must not be broken by it) and
RESETTING states kill monsters via `getEntities({ families: ["trickymaze"] })`
→ `entity.remove()` for each. The entity's runtime-state-map entry is cleared
by the existing `afterEvents.entityRemove` handler in `monsters/state.ts`.

---

## 6. Shared tick framework

### 6.1 Scheduler (`monsters/scheduler.ts`)

One `system.runInterval(tickAll, 4)` — every 4 game ticks, 5 Hz. On each tick:

1. Scan: `overworld.getEntities({ families: ["trickymaze"] })`.
2. For each entity:
   - Read `trickymaze:behavior` dynamic property.
   - Look up tick function in the behavior registry.
   - Call `tickFn(entity)`. Catch and `console.warn` on throw so one bad
     entity doesn't kill the whole loop.

### 6.2 Registry (`monsters/registry.ts`)

```ts
export type TickFn = (entity: Entity) => void;
export function registerBehavior(name: string, fn: TickFn): void;
```

`patroller.ts` calls `registerBehavior("patroller", tickPatroller)` at module
load. `main.ts` does `import "./monsters/registry"` (side-effect import) to
wire up the system interval.

### 6.3 Helpers (`monsters/helpers.ts`)

- `nearestPlayer(entity, maxDist)` — `dim.getPlayers({ location, maxDistance })`
  → closest.
- `isInFrontOf(entity, player, arcDeg)` — dot product of the entity's view
  vector (from `entity.getViewDirection()`) and unit vector to player; compare
  to `cos(arcDeg/2)`.
- `hasLineOfSight(entity, player)` — `entity.getBlockFromViewDirection({
  maxDistance: 6 })`; compare hit distance to player distance (player visible
  if no block hit or block farther than player).
- `faceToward(entity, target)` — compute yaw from delta-xz, call
  `entity.setRotation({ x: 0, y: yaw })`.

---

## 7. Patroller behavior (`monsters/patroller.ts`)

### 7.1 Runtime state

```ts
type PatrollerRuntime =
  | { kind: "patrol";   dir: +1 | -1; stuckTicks: number; lastPos: Vector3 }
  | { kind: "charge";   targetId: string; startTick: number; lastHitTick: number }
  | { kind: "cooldown"; untilTick: number; dir: +1 | -1 };
```

### 7.2 Tick function

On first tick per entity (missing map entry), initialize to
`{ kind: "patrol", dir: +1, stuckTicks: 0, lastPos: entity.location }`.

**Patrol state:**

1. Compute axis vector from config (N=`(0,0,-1)`, S=`(0,0,+1)`, E=`(+1,0,0)`,
   W=`(-1,0,0)`).
2. Compute turn-around target:
   `homePoint + axisVec * dir * (patrolLength/2 - 0.5)`.
3. If distance from entity to target < 0.6 blocks → flip `dir`.
4. Movement: `entity.applyImpulse(axisVec * dir * 0.35)`.
5. Stuck detection: if `distance(lastPos, entity.location) < 0.1`, increment
   `stuckTicks`; else reset to 0. If `stuckTicks > 3` (~0.6 s), call
   `entity.tryTeleport(homePoint, ...)` and reset stuckTicks. Update lastPos.
6. Aggro check: `p = nearestPlayer(entity, 5)`. If `p` exists,
   `isInFrontOf(entity, p, 90)` is true, and `hasLineOfSight(entity, p)` is
   true → transition to `charge { targetId: p.id, startTick: currentTick,
   lastHitTick: 0 }`. Keep `dir` for when we fall back to patrol.

**Charge state:**

1. `p = world.getEntity(targetId)`. If missing, dead, or
   `currentTick - startTick > 15` (3 s at 5 Hz = 15 ticks) → transition to
   `cooldown { untilTick: currentTick + 5, dir }` (~1 s cooldown).
2. `faceToward(entity, p)`.
3. Movement: `entity.tryTeleport(entity.location + normalize(p.location -
   entity.location) * 0.8, { checkForBlocks: true, keepVelocity: false })`.
4. Contact damage: if `distance(entity, p) < 1.5` and
   `currentTick - lastHitTick >= 3` (~600 ms throttle):
   `p.applyDamage(Math.round(4 * damageMult), { cause: "entityAttack",
   damagingEntity: entity })`; set `lastHitTick = currentTick`.

**Cooldown state:**

1. Do the patrol movement (steps 1–5 above) but **skip the aggro check**.
2. When `currentTick >= untilTick`, transition to
   `patrol { dir, stuckTicks: 0, lastPos: entity.location }`.

### 7.3 Spec alignment (parent §5.4)

- Detection range 5 blocks ✓
- Frontal 90° arc ✓
- Charge damage 4 ✓ (scaled by `damageMult`)
- Break after 3 s or target death ✓
- Never turns for flanking/trailing players ✓ (the `isInFrontOf` gate is what
  enforces this; the entity only rotates during charge, not during patrol)

---

## 8. Theme lookup (`monsters/themes.ts`)

```ts
export type Behavior = "patroller"; // expanded in later plans
export type Theme = "old_prison" | "the_depths" | "nethers_edge" | "the_abyss";

export const themeForFloor = (floor: number): Theme =>
  floor <= 2 ? "old_prison" :
  floor <= 4 ? "the_depths" :
  floor <= 6 ? "nethers_edge" : "the_abyss";

const IDENTIFIER_TABLE: Record<Behavior, Partial<Record<Theme, string>>> = {
  patroller: { old_prison: "trickymaze:patroller_zombie" },
};

export function resolveEntityId(behavior: Behavior, theme: Theme): string {
  const id = IDENTIFIER_TABLE[behavior]?.[theme];
  if (!id) throw new Error(`no entity registered for ${behavior}/${theme}`);
  return id;
}
```

Throw-on-missing is deliberate: it surfaces loudly if a later plan adds a
higher-tier theme without populating the table.

---

## 9. Stat scaling (`monsters/stats.ts`)

```ts
export const healthMultiplier = (floor: number) => 1 + 0.10 * (floor - 1);
export const damageMultiplier = (floor: number) => 1 + 0.10 * (floor - 1);
```

Matches parent spec §5.7. On Plan 2 (L1 only), this returns 1.0 — but the
plumbing is in place so future plans that generate higher floors see scaled
patrollers without further changes.

---

## 10. HUD mob counter

Parent spec §3.1 actionbar format is `Floor N · Key: <state> · Mobs: X`. Plan 1
did **not** implement this HUD — only the respawn-countdown actionbar in
`events/death.ts`. Plan 2 introduces the in-run HUD as a new module
`src/ui/hud.ts`:

- A `system.runInterval(refreshHud, 20)` (1 Hz) loop.
- When `RunState.state === "FLOOR_ACTIVE"`, each player receives
  `player.onScreenDisplay.setActionBar(\`Floor ${floor} · Key: ${keyState} · Mobs: ${mobCount}\`)`.
- `mobCount` is `overworld.getEntities({ families: ["trickymaze"] }).length`
  (single scan per refresh, not per-player).
- In PRISON / IDLE / RESETTING states the HUD loop does nothing; the respawn
  countdown in `death.ts` continues to own the actionbar during RESETTING.
- The key-state string is `"not found"` when `keyFoundThisFloor === false`
  and `"FOUND"` when `true`, matching parent spec §3.1 semantics.

---

## 11. Testing

### 11.1 Pure unit tests (vitest, `tests/`)

- **`spawn_plan.test.ts`** — fixture maze (small hand-built `Maze` object):
  - Straight runs ≥ 4 cells are detected; shorter ones are ignored.
  - Entry count = `max(1, floor(totalCells / 12))` for sizes 6×6, 12×12, 20×20.
  - No entries at entrance or exit cells.
  - Axis matches corridor orientation in each entry.
  - `patrolLength` = runCellCount × 3.
  - Same seed → same entries (determinism).
- **`themes.test.ts`** — `themeForFloor(1..20)` boundary cases;
  `resolveEntityId("patroller", "old_prison")` returns the expected id;
  `resolveEntityId("patroller", "the_depths")` throws.
- **`stats.test.ts`** — `healthMultiplier(1) === 1.0`, `healthMultiplier(10) === 1.9`;
  same for damage.

### 11.2 Integration smoke

New script event `trickymaze:smoke_monsters` (ops only, gated by scriptevent
permission). Runs in a dev world:

1. Spawn one `trickymaze:patroller_zombie` at `(0, 0, 0)` relative to sender.
2. Write config dynamic properties (synthetic home point, axis, length=12).
3. Wait 1 tick. Query
   `dim.getEntities({ families: ["trickymaze_patroller"] })`.
4. Assert count === 1. Log pass/fail to content log.
5. Call `entity.remove()` to clean up.

Not shipped in player-facing builds; lives in `scripts-dev/` or gated behind
the scriptevent which non-ops cannot fire.

### 11.3 Manual QA (new `docs/superpowers/specs/2026-04-23-plan-2-qa.md`)

- Enter Floor 1 — ≈12 patrollers visible, walking straight lines, reversing at
  corridor ends.
- Stand in front of one within 5 blocks — it charges, hits for ~4 dmg on
  contact, breaks off after ~3 s and resumes patrolling.
- Stand behind or beside a patrolling one at 2 blocks — it ignores you.
- Kill one with a sword — no item drops; vanilla death animation plays.
- Let one kill you — Plan 1's death handler fires (spectator; last death →
  reset).
- HUD shows `Floor 1 · Key: not found · Mobs: 12` (or current count).
- Reload the world mid-floor — patrollers persist, resume patrol on their
  configured axis, HUD counter matches.
- `/kill @e[family=trickymaze_patroller]` — all gone, HUD shows `Mobs: 0`,
  next floor generates cleanly.
- Corner case: a Patroller gets shoved into a wall by an explosion / knockback
  — within ~0.6 s, teleports back to its `homePoint` and resumes patrol.

---

## 12. Non-goals (Plan 2)

- Any of the six other behaviors in parent spec §5.4.
- Theme variants beyond `old_prison`.
- Wither-skeleton L7+ theme artwork integration (files renamed only; dormant).
- Per-behavior sounds or custom death FX.
- Per-floor monster density tuning beyond the ~1 per 12 cells rule.
- Anti-spawn purge loop (parent spec §9.3) — deferred to Plan 5.

---

## 13. Open assumptions

- `@minecraft/server` 2.x stable exposes `entity.applyImpulse`,
  `entity.tryTeleport`, `entity.getViewDirection`,
  `entity.getBlockFromViewDirection`, `player.applyDamage`, and dynamic-property
  APIs on entities. If any are still beta-gated on the target Bedrock build,
  the plan opens a scoped exception rather than retargeting.
- `generation/floor.ts` can return the `Maze` object (or be threaded through
  so the `Maze` is available at spawn-manifest time) without major rework. If
  not, the plan includes a small refactor.
- Vanilla zombie geometry/texture paths are valid references from our
  resource pack without bundling the assets ourselves.
- The floor anchor (`X=10000, Y=-50, Z=10000` per parent spec §4.5) is loaded
  and ticking when the spawner runs — Plan 1 already wraps it in a ticking
  area.
