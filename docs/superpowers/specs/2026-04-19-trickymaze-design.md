# TrickyMaze — Design Spec

**Date:** 2026-04-19
**Status:** Draft — awaiting user review before implementation planning.
**Target:** Minecraft Bedrock Edition 1.21.100+, `@minecraft/server` 2.x stable.

---

## 1. Overview

TrickyMaze is a Minecraft Bedrock add-on that turns a world into a descending
dungeon crawl. On first join, players are auto-teleported into a permanent
stone-brick prison with 8 loaves of bread each. Opening the prison door starts
Floor 1: a procedurally generated maze filled with custom-AI monsters.
Finding the floor's Dungeon Key and using it on the descending iron door
triggers an ominous "Descending to Level N" broadcast, demolishes the old floor,
and builds a larger, harder one below. If every player dies, all players spawn
back in the prison and the run resets to Floor 1.

**Key design goals:**

- Co-op friendly (2–4 players on Realms / LAN).
- Distinct, learnable monster AI — no vanilla wander patterns.
- Every descent visibly, audibly, and mechanically escalates.
- Zero manual setup: drop the pack into a world and play.

---

## 2. Architecture

### 2.1 Pack structure

TrickyMaze ships as a paired **behavior pack + resource pack**, both using
`format_version: 2`. The behavior pack manifest declares a `script` module
entry (`scripts/main.js`) and a dependency on `@minecraft/server` ^2.0.0.

```
trickymaze/
  behavior_pack/
    manifest.json
    entities/               # 7 monster behaviors × 4 theme variants
    items/                  # "Dungeon Key" (trickymaze:dungeon_key)
    spawn_rules/            # empty conditions — never natural-spawn
    loot_tables/trickymaze/ # per-tier chest contents
    scripts/                # compiled JS (entry: main.js)
  resource_pack/
    manifest.json
    textures/               # recolors, key icon
    sounds/                 # cue definitions, descent sting
    sounds.json
  src/                      # TypeScript sources
    main.ts                 # event router + init (~30 lines)
    state/run.ts
    generation/
      maze.ts               # pure recursive-backtracking
      floor.ts              # maze -> blocks
      prison.ts
      themes.ts
    monsters/
      base.ts
      patroller.ts
      sentry.ts
      sleeper.ts
      stalker.ts
      lurker.ts
      charger.ts
      executioner.ts
    ui/
      broadcasts.ts
      hud.ts
      atmosphere.ts
    events/
      death.ts
      descent.ts
      purge.ts              # anti-spawn purge loop
  tests/
    maze.test.ts
    themes.test.ts
    loot.test.ts
  tsconfig.json
  package.json
```

### 2.2 Module boundaries

- `state/run.ts` — Singleton `RunState`: current floor number, `aliveSet:
  Set<playerId>`, `keyFoundThisFloor: boolean`, `anchor: Vector3`, run
  state enum. Persists via `world.getDynamicProperty("trickymaze:run")`.
- `generation/` — Pure maze generation (no Minecraft imports → Node-testable),
  block-emitting floor builder, prison builder, theme palette lookup.
- `monsters/` — One file per behavior, each exporting `tick(entity)`. `base.ts`
  provides the shared tick scheduler and geometric helpers.
- `ui/` — Title, actionbar, chat, and sound helpers. The **only** module
  allowed to call `world.sendMessage` or `player.onScreenDisplay`.
- `events/` — Translate Bedrock events into `RunState` transitions. No
  game logic here; it is a dispatcher.
- `main.ts` — Bootstrap state, register event handlers, start the monster tick
  loop and the purge loop.

This mirrors a hexagonal layout: `generation/` and `state/` are pure domain
logic; everything with Minecraft API side effects lives in a thin outer ring.

---

## 3. Run State Machine

```
IDLE → PRISON → FLOOR_ACTIVE → DESCENDING → FLOOR_ACTIVE (N+1) → …
                      ↓ (all dead)
                   RESETTING → PRISON
```

### 3.1 States

- **IDLE** — world just loaded. On first player join: build prison if absent,
  transition to PRISON.
- **PRISON** — players in permanent prison room, adventure mode, 8 bread each.
  A pressure plate in front of the prison's iron door triggers `startRun()` →
  build Floor 1 → FLOOR_ACTIVE.
- **FLOOR_ACTIVE** — monsters ticking, HUD showing
  `Floor N · Key: <state> · Mobs: X`. Picking up the `trickymaze:dungeon_key`
  flips `keyFoundThisFloor = true`. Using the key on the floor's iron door
  → DESCENDING.
- **DESCENDING** — input lock (teleport to staging platform, temporary
  spectator), broadcast, demolish, generate, break barrier, teleport back,
  restore adventure. ~4 seconds total.
- **RESETTING** — triggered when `aliveSet` empties during FLOOR_ACTIVE.
  5-second actionbar countdown, then: demolish all floors, clear monsters/items,
  reset to Floor 0, teleport everyone to prison, restore adventure + bread.

### 3.2 Player lifecycle

- **Player dies** → `afterEvents.entityDie` → `setGameMode(spectator)`, remove
  from `aliveSet`. Empty set → RESETTING.
- **Player joins mid-run** → spectator until the next reset.
- **Player leaves** → removed from `aliveSet`. If empty, triggers reset.

### 3.3 Key lifecycle

`keyFoundThisFloor` resets to `false` on every new floor. Any remaining key
items in any player inventory are removed at descent (one-floor, one-key).

---

## 4. Maze Generation

### 4.1 Algorithm

Recursive backtracking ("DFS carver") in `generation/maze.ts`. Produces long
winding corridors with few shortcuts — the right feel for a dungeon.

```ts
type Cell = { walls: { N: boolean; S: boolean; E: boolean; W: boolean } };
function generateMaze(
  width: number,
  height: number,
  rng: () => number,
): {
  cells: Cell[][];
  entrance: { x: number; y: number };
  exit: { x: number; y: number };
  deadEnds: { x: number; y: number }[];
  bfsDistance: (cell: { x: number; y: number }) => number;
};
```

- **Entrance** — fixed at `(0, 0)` (north-west), coincident with the
  staircase-up from the previous floor or prison.
- **Exit** — the cell furthest from the entrance by BFS distance. Guarantees
  the descent staircase is meaningfully far, not just "on the other side."
- **Seed** — `floorNumber + worldSeed`. Runs are reproducible for debugging.
  The seed is logged on each generation.

### 4.2 Cell-to-block mapping

Each cell is a **3×3 block footprint**, **4 blocks tall** (floor + 3 air +
ceiling). Walls are 1 block thick, shared between neighbors; an N×M maze
footprint = `(3N+1) × (3M+1)` blocks.

### 4.3 Build sequence

Batched `dimension.fillBlocks` calls (chunked to ≤ 32,768 blocks per call).
Built top-down for each floor:

1. Fill entire floor volume with air (clears previous floor if overlapping).
2. Fill floor layer with theme `floorBlock`.
3. Fill ceiling layer with theme `ceilingBlock`.
4. For each cell, fill any still-standing wall with theme `wallBlock`.
5. Scatter lights: one soul lantern (or theme equivalent) every ~8 cells,
   placed in ceiling.
6. Place staircase-down 5×5 alcove at `exit` cell — iron door on the maze side,
   barrier of theme `wallBlock` behind the door.
7. Place chests (§7).
8. Place key-chest at a randomly selected dead-end cell at BFS distance ≥
   `floor(width * 0.5)` from entrance. **Not** at the exit — forces exploration.
9. Place staircase-up at entrance (connects to prison on Floor 1, or previous
   floor's exit staircase on deeper floors).
10. Spawn monsters from `spawnManifest` (§5.6).

### 4.4 Sizes and spacing

- **L1:** 12×12 cells (37×37 blocks).
- **Growth:** +4 cells per dimension per level.
- **Cap:** 40×40 cells (121×121 blocks). Floors ≥ 8 all use the cap size.
- **Vertical:** each floor's ceiling sits 6 blocks below the previous floor's
  ceiling. Staircases drop 5 blocks.

### 4.5 Build location

Fixed far-away anchor: **`X=10000, Y=-50, Z=10000`**, overworld dimension.
Floors stack downward from the anchor. Full cleanup on reset (all floor volumes
filled with air).

### 4.6 Chunk loading

The builder wraps the anchor volume with a `tickingarea` via
`runCommand("tickingarea add ...")` before generation and removes it on reset.
This guarantees target chunks stay loaded during `fillBlocks` and during
player traversal.

---

## 5. Monster AI Framework

### 5.1 Core challenge and approach

Bedrock's built-in behaviors cannot express "ignore players behind me" or
"freeze when watched." Solution: disable vanilla AI entirely; drive behavior
from a single script tick loop.

### 5.2 Custom entity declarations

Each behavior has up to four **theme variants** — same behavior, different base
mob depending on the active floor's theme (§5.5). All variants share the
behavior's tick function; only the entity JSON differs (model, texture, family
hint). All entities include the `trickymaze` type-family tag.

Entity JSON is stripped to the minimum:

- `minecraft:movement.basic`, `minecraft:navigation.walk` — kept so Bedrock
  accepts the entity, but we drive movement ourselves via
  `entity.applyImpulse` / `entity.tryTeleport`.
- `minecraft:behavior.hurt_by_target` — **removed**. No auto-targeting.
- `minecraft:breathable`, `minecraft:physics`, `minecraft:health` — kept.
- `minecraft:type_family` — includes `trickymaze` + `monster`.
- Component groups for per-mob states (e.g., `trickymaze:berserk` for Sleeper).
- Custom dynamic properties for `homePoint`, `patrolAxis`, `triggerRadius`,
  set at spawn time by the spawner.

### 5.3 Shared tick scheduler (`monsters/base.ts`)

- `system.runInterval(tickAll, 4)` — every 4 game ticks (5 Hz). Enough for
  responsive AI without burning CPU.
- `tickAll()` iterates a `Map<behaviorName, TickFn>`, calls `fn(entity)` for
  each matching live entity on the active floor. One
  `dimension.getEntities({ families: ["trickymaze"] })` scan per tick.
- Helpers: `nearestPlayer(entity, maxDist)`, `isInFrontOf(entity, player,
  arc)`, `hasLineOfSight(entity, player)`, `faceToward(entity, target)`,
  `isLookingAt(player, entity, cone)`.

### 5.4 Behaviors (7)

1. **Patroller** — stored `homePoint`, `patrolAxis` (unit vector N/S/E/W along
   the corridor), and `patrolLength` (total block distance of the corridor
   segment, determined by the spawner from the maze graph). Steps toward the
   next waypoint along the axis; flips direction at `homePoint ±
   patrolLength/2`. If `nearestPlayer(5)` is `isInFrontOf(90°)` → charge
   state: sprint at player, `applyDamage(4)` on contact, break after 3s or
   player death. Never turns to face a flanking or trailing player.
2. **Sentry Archer** — fixed `homePoint`. Finds nearest player within 16 blocks
   and line-of-sight. If found → `faceToward`, shoots an arrow every 40 ticks
   via `entity.shootProjectile`. Never moves.
3. **Sleeper** — stored `triggerRadius` (3 blocks). Idle at `homePoint`
   (`silent: true`, `no_ai` component group active). Player enters radius →
   swap to `trickymaze:berserk` component group, chase for 6s or until player
   is outside 10 blocks, then teleport back and re-sleep.
4. **Stalker** — checks whether any player's view frustum contains the entity
   (`isLookingAt(cone=30°)`). If yes → hold position, snap-face away. If no →
   pathfind-teleport 2 blocks toward nearest player per tick (no visible
   walking). Contact → `applyDamage(6)`.
5. **Dead-End Lurker** — spawned only in dead-end cells, 1-cell trigger. Idle
   (silent, `minecraft:is_invisible`) until any player enters its cell →
   become visible, lunge, `applyDamage(5)` on contact, despawn after 10s.
   One-shot ambush.
6. **Charger** (hoglin-based) — unlocks L4+. Wide 120° detection arc up to 10
   blocks. On detection → sprint in a straight line until hitting a wall, then
   stun for 3s (visible stagger). Heavy knockback on contact. Dodgeable in
   wide spaces; lethal in narrow corridors.
7. **Executioner** (wither-skeleton-based) — unlocks L6+, exactly **1 per
   floor**. Spawned as guardian of the key-chest cell. Slow, high-HP, stone
   sword that inflicts wither on hit. Deliberately boss-feeling. On floors
   with an Executioner, no other monster guards the key.

### 5.5 Theme variants (base-mob swaps per floor)

| Behavior      | L1–2 Old Prison | L3–4 The Depths | L5–6 Nether's Edge | L7+ The Abyss         |
|---------------|-----------------|-----------------|--------------------|-----------------------|
| Patroller     | zombie          | husk            | piglin             | wither patroller      |
| Sentry Archer | skeleton        | stray           | piglin + crossbow  | blaze                 |
| Sleeper       | spider          | vindicator      | piglin brute       | wither sleeper        |
| Stalker       | enderman-ish    | enderman-ish    | enderman-ish       | enderman-ish          |
| Lurker        | zombie villager | drowned         | zombified piglin   | wither lurker         |
| Charger       | —               | —               | hoglin             | hoglin                |
| Executioner   | —               | —               | —                  | wither skeleton       |

The spawner picks the concrete entity type at spawn time based on the active
floor's theme.

### 5.6 Unlock schedule and density

| Floor | Unlocked behaviors                                    |
|-------|-------------------------------------------------------|
| 1     | Patroller                                             |
| 2     | + Sentry Archer                                       |
| 3     | + Sleeper                                             |
| 4     | + Stalker, + Charger                                  |
| 5     | + Lurker                                              |
| 6+    | + Executioner (1 per floor)                           |

Spawn density: ~1 monster per 12 cells on L1 (≈ 12 mobs), scaling linearly to
~1 per 6 cells at floor cap (≈ 130+ mobs). Distribution across unlocked types
is weighted to keep Patrollers the most common filler.

### 5.7 Stat scaling per floor

On spawn: `hp = baseHP * (1 + 0.10 * (floor - 1))`, same formula for damage.
Floor 10 mob is ≈ 1.9× stronger than Floor 1. Applied via
`entity.getComponent("minecraft:health").setCurrent(...)` and a stored
`damageMultiplier` property used when the behavior calls `applyDamage`.

### 5.8 Spawn placement rules

Builder emits a `spawnManifest: {entity, pos, config}[]` from maze analysis:

- Patrollers → straight corridors ≥ 4 cells long.
- Sentries → T-intersections and junctions.
- Sleepers → any corridor cell.
- Stalkers → large open chambers (1–2 cells widened from adjacent cells).
- Lurkers → dead-end cells **after chest allocation** (§7.1.1).
- Chargers → straight corridors ≥ 6 cells long.
- Executioner → the key-chest cell.

The spawner iterates the manifest after block placement completes.

---

## 6. Descent Flow

### 6.1 The key item

A named nether star rendered as a custom item type `trickymaze:dungeon_key`.
Display name **"Dungeon Key"**, lore **"Fits the iron door. Single use."** Only
one exists per floor; placed in the key-chest on floor generation.
Adventure-mode safe (nothing to place/destroy with it).

### 6.2 Door interaction

On `world.beforeEvents.playerInteractWithBlock`:

1. If `block.typeId !== "minecraft:iron_door"`, return.
2. If block position ≠ `RunState.exitDoorPos`, return (other iron doors in
   world are ignored).
3. If the player's inventory contains a `trickymaze:dungeon_key`:
   - Cancel default interaction.
   - Consume 1 key from that player's inventory.
   - Trigger the descent sequence.
4. Otherwise:
   - Cancel default interaction.
   - Actionbar message: *"The door is sealed. Find the key."*

Key possession is what matters — not world existence. If a player drops the
key on the ground, another player must pick it up to open the door.

### 6.3 Descent sequence (~4 seconds)

| t (s) | Action                                                                                                                                                                                                                          |
|-------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 0.0   | Lock: teleport all living players to a 5×5 staging platform above the anchor; temporarily set to spectator. Kill all `trickymaze:*` family entities on the old floor. Clear dropped items in the floor volume.                    |
| 0.0   | Broadcast: `setTitle("§4§l§oDescending to Level N", {subtitle: "§7...into deeper darkness", fadeIn: 10, stay: 40, fadeOut: 20})`. Thunder via `setWeather`. `playSound` per player: `ambient.cave`, `portal.portal`, distorted `mob.villager.haggle`. |
| 0.5   | Demolish: `fillBlocks(oldFloorVolume, "minecraft:air")` — chunked.                                                                                                                                                              |
| 1.0   | Generate: run maze, floor builder, chest placement, monster spawn for level N+1.                                                                                                                                                |
| 3.0   | Break barrier: fill the wall blocks behind the descending door with air. The path opens.                                                                                                                                        |
| 3.5   | Restore: set all staging players back to adventure; teleport each to the new floor's entrance cell. Update `RunState.floor = N`, reset `keyFoundThisFloor = false`.                                                             |
| 4.0   | HUD refresh: actionbar shows `Floor N · Key: not found · Mobs: M`.                                                                                                                                                              |

If any step throws, fall through to the restoration fallback (§9.2).

---

## 7. Loot and Chests

### 7.1 Chest types and density

- **Supply chest** (common) — food + low-tier consumables. Placed in regular
  dead-ends.
- **Armory chest** (rare) — guaranteed 1 weapon + 1 armor piece + 1–2
  food/misc. Placed only in dead-ends with BFS distance ≥ 60% of max.

**Density:** ~1 chest per 20 cells (sparse). Split 70% supply / 30% armory. On
L1 (144 cells): 7 chests total → 5 supply + 2 armory.

#### 7.1.1 Dead-end allocation order

Dead-end cells are a shared resource for key-chest, armory chests, supply
chests, and Lurkers. Allocation is deterministic per floor:

1. **Key-chest** — 1 dead-end, BFS ≥ 50% of max, chosen first (constraint may
   overlap with armory tier but key takes precedence).
2. **Armory chests** — next N dead-ends, BFS ≥ 60% of max, excluding the
   key-chest cell.
3. **Supply chests** — next M dead-ends, any BFS distance, excluding
   already-allocated cells.
4. **Lurkers** — remaining dead-ends. Count is capped at `floor(remaining *
   0.6)` so not every empty dead-end becomes an ambush.
5. If any later step runs out of eligible cells, it quietly places fewer
   instances rather than erroring — logged via `console.warn`.

### 7.2 Loot tables (per-floor tiering)

Stored as Bedrock loot tables in `behavior_pack/loot_tables/trickymaze/`.

| Floors | Armor tier               | Weapons                    | Food                        | Misc                                  |
|--------|--------------------------|----------------------------|-----------------------------|---------------------------------------|
| 1–2    | leather (partial sets)   | stone sword, wooden axe    | bread, raw potato           | arrows(8), torches(4)                 |
| 3–4    | + chainmail, iron pieces | + iron sword, bow          | + cooked beef, baked potato | + golden apple (rare)                 |
| 5–6    | + iron full, diamond pcs | + iron axe, crossbow       | + golden carrot             | + ender pearl (rare), shield          |
| 7+     | + diamond full           | + diamond sword, power-I bow | + enchanted golden apple (rare) | + totem of undying (very rare)      |

- Supply chests roll 3–5 items from the active tier's food+misc pool.
- Armory chests roll 1 armor, 1 weapon (both guaranteed), plus 1–2 food/misc.

### 7.3 The key-chest

Always contains exactly one `trickymaze:dungeon_key`. Placed per §4.3. On
floors with an Executioner (L6+), the Executioner spawns in the key-chest
cell — defeating the Executioner is a prerequisite to reaching the key.

### 7.4 Starting inventory

8 `minecraft:bread` on respawn in prison. Implementation: clear inventory +
grant bread on every transition into PRISON state and on initial prison entry.

### 7.5 Adventure-mode compatibility

Chests are openable in adventure mode by default. All chest-sourced weapons
and armor work as normal combat gear. Players cannot place blocks regardless
of items held — which we want (no bridging past walls). No `can_destroy` or
`can_place_on` tags are needed.

---

## 8. Theming and Atmosphere

### 8.1 Per-floor palette

Defined in `generation/themes.ts` as a lookup keyed by floor range.

| Floors | Theme         | Wall              | Floor               | Ceiling           | Light                                  |
|--------|---------------|-------------------|---------------------|-------------------|----------------------------------------|
| 1–2    | Old Prison    | mossy cobblestone | cobblestone         | cobblestone       | torch (sparse)                         |
| 3–4    | The Depths    | cobbled deepslate | deepslate bricks    | deepslate tiles   | soul lantern                           |
| 5–6    | Nether's Edge | blackstone        | polished blackstone | basalt            | soul lantern + netherrack fire-pockets |
| 7+     | The Abyss     | obsidian          | crying obsidian     | obsidian          | end rod + shroomlight                  |

### 8.2 Decorative accents (≤ 5% of wall cells per floor)

- **Old Prison** — iron bars as "cell windows" on random interior walls;
  occasional cobwebs in corners.
- **The Depths** — pointed dripstone from ceiling; skeleton skulls on floor
  debris piles.
- **Nether's Edge** — soul fire pockets. Players receive a looping
  `fire_resistance` effect while on Nether's Edge and Abyss floors so soul
  fire cannot silently kill them. Ambient `ambient.nether_wastes.mood` every
  30–60s.
- **The Abyss** — floating end rods; crying obsidian "tear trails"; quiet
  `portal.portal` ambient loops.

### 8.3 Ambient layer (all floors, `ui/atmosphere.ts`)

- `ambient.cave` at 30% volume every 40–120s randomly per player.
- Low-frequency heartbeat pulse (retuned `block.sculk.charge`) every 10s on
  floors ≥ 5.
- Title flash `§4BEWARE` (400ms) when a Stalker first enters the
  "player-stopped-looking" state — scary micro-feedback that the unseen just
  moved.

### 8.4 Lighting balance

Target light level **~6** in corridors. Combined with anti-spawn defenses
(§9), this leaves the dungeon dim enough to feel threatening but bright
enough to navigate.

---

## 9. Anti-Spawn Defenses (defense in depth)

Without prevention, vanilla hostiles will spawn inside the maze: zombies,
skeletons, creepers, and (critically) spiders, which ignore light level. Three
layered defenses:

### 9.1 Gamerule at run scope

When `RunState` first transitions from `IDLE → PRISON`, run
`gamerule doMobSpawning false`. Turns off all natural spawning worldwide.
Since TrickyMaze is the world's purpose (auto-start on first join), this is
acceptable. Custom entities spawned via `dimension.spawnEntity(...)` are
unaffected by the gamerule.

### 9.2 Spawn-rule prevention on custom entities

Each `trickymaze:*` entity ships with a `behavior_pack/spawn_rules/` JSON
containing no `conditions` block — the entities can only be summoned via the
script API, never natural-spawned. Prevents any scenario where a custom mob
leaks into the world outside a run.

### 9.3 Active-floor purge tick

`events/purge.ts` runs every 20 game ticks (1 Hz). Scans the active floor's
AABB **and** the prison's AABB; any hostile mob not in the `trickymaze`
family is `kill()`'d. Also kills passives (bats, squids) to preserve dungeon
purity. Catches the rare edge case where the gamerule is toggled back on
manually or a mob transfers in from an adjacent loaded chunk.

### 9.4 Lifecycle integration

- On `RESETTING → PRISON` transition, re-assert `doMobSpawning false`.
- `/scriptevent trickymaze:shutdown` restores `doMobSpawning true`, removes
  ticking areas, and ends the purge loop — safe way to retire TrickyMaze
  from a world.

---

## 10. Edge Cases and Error Handling

### 10.1 Handled edge cases

- **Chunk unloaded mid-generation** — ticking area wraps anchor volume.
- **Script reload mid-run** — `RunState` rehydrates from dynamic property;
  monster registry rebuilds by scanning `trickymaze` family.
- **Player disconnects while last alive** — treated as death for reset
  purposes. If `aliveSet` empties, RESETTING.
- **Operator toggles gamemode manually** — we reassert adventure on
  `playerSpawn` and descent transitions; creative-mode players are tolerated
  for debugging, not defended against.
- **Inventory overflow on prison entry** — inventory is cleared before
  granting bread, so nothing carries in from outside.
- **Concurrent interactions on the door** — `RunState` guards with a
  state check; only the first valid interaction during FLOOR_ACTIVE has
  effect.
- **`fillBlocks` volume too large** — max is 32,768 blocks per call; builder
  chunks large floors into 16×16 tiles.
- **Entity despawn across descent** — `kill` all `trickymaze:*` family
  entities during the demolish step to prevent ghosts.

### 10.2 Error philosophy

Generation and tick code log via `console.warn` on exception and continue. A
crash during generation triggers a **restoration fallback**: force-reset to
prison with an actionbar explanation to all players ("*The dungeon
collapsed. Restarting.*"). We never silently swallow; we just keep the world
playable.

---

## 11. Testing Strategy

### 11.1 Unit tests

Node runner (`vitest` or `node --test`), in `tests/`. Exercises the pure
layers:

- `maze.test.ts` — every generation produces a connected graph, entrance ≠
  exit, BFS distances are monotonic, dead-end count > 0 for all sizes ≥ 4×4.
- `themes.test.ts` — every floor 1–20 resolves to a valid palette.
- `loot.test.ts` — armory rolls always produce ≥ 1 weapon + 1 armor; supply
  rolls respect tier boundaries; totem only appears on L7+.

### 11.2 Integration smoke

`scripts/dev/smoke.ts` exposed via `/scriptevent trickymaze:smoke`:

1. Build a floor at a test anchor.
2. Spawn one of each monster type.
3. Assert entity presence via `dimension.getEntities`.
4. Tear down. Log pass/fail to content log.

Runnable in a dev world. Not part of the shipped behavior pack (or included
but gated behind the scriptevent, which non-ops cannot fire).

### 11.3 Manual QA scenarios

Checklisted in `docs/superpowers/specs/2026-04-19-trickymaze-qa.md` after
implementation begins. Representative scenarios:

- Solo — die alone during run; reset triggers; respawn in prison with bread.
- Solo — find key then die before reaching door; reset triggers.
- Solo — complete L1 → L2 → L3; verify theme swaps and new monster unlocks.
- Co-op (2) — one player dies, other completes floor; spectator rejoins on
  descent? (No — spectator stays spectator until reset.)
- Co-op (2) — player joins mid-run; remains spectator until reset.
- Edge — operator flips `doMobSpawning true`; purge tick still clears vanilla
  spawns.

---

## 12. Non-Goals (v1)

- Persistent deepest-floor leaderboard.
- Boss encounters on fixed intervals (Executioner is a per-floor guardian, not
  a boss room).
- World-save resume-from-floor-N (dynamic property retains floor number, but
  we reset to prison on world restart rather than rebuild mid-floor — simpler
  and safer).
- Multi-world / arena rotation.
- Difficulty settings / configurable loot.
- Vanilla-world coexistence (TrickyMaze assumes it owns the world).

---

## 13. Open Assumptions

These are explicit assumptions the design depends on. Revisit if false:

- Target Bedrock clients are all ≥ 1.21.100 and can run `@minecraft/server`
  2.x stable APIs without beta toggles.
- Players accept the world-wide `doMobSpawning false`.
- The anchor at `X=10000, Y=-50, Z=10000` is inside the generated world and
  not in an exotic biome that breaks ticking areas (deepslate band in normal
  overworld).
- 2–4 simultaneous players is the realistic upper bound; performance isn't
  tuned for 8+.
