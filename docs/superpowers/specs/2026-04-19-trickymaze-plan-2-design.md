# TrickyMaze Plan 2 — Descent, Keys & Themes (Design)

**Status:** Approved for implementation planning
**Date:** 2026-04-19
**Predecessor:** Plan 1 — Foundation (merged 2026-04-19)
**Successor plans:** Plan 3 (monsters), Plan 4 (loot), Plan 5 (atmosphere polish — includes decorative accents and Nether's Edge / Abyss themes)

---

## 1. Scope & Goals

Plan 2 extends the Plan 1 foundation to a complete 4-floor run:

- **Descent cinematic** — floors advance through a 4-second scripted sequence with title, sound stingers, and thunder weather.
- **Key progression** — each floor contains a chest holding a renamed `tripwire_hook` ("Floor Key"). Players carry the key to the exit pressure plate, which consumes it and opens an iron door.
- **Multi-floor runs** — 4 playable floors stacked vertically beneath the prison anchor.
- **Two themes** — Old Prison (L1–2) and Depths (L3–4). Block palette only; decorative accents deferred to Plan 5.
- **Death as spectator** — a dead player becomes a spectator until either the floor is cleared (restored to survival on the next floor) or all players die (GameOver).
- **Run completion** — clearing floor 4 resets to `Idle`; prison rebuilds on the next pressure-plate step. Total death transitions to `GameOver`; admin issues `/scriptevent trickymaze:restart` to reset.

**Non-goals for Plan 2:** monsters, loot beyond the key, decorative accents, custom-item pack definitions, Nether's Edge / Abyss themes.

## 2. Run Shape

```
Idle
  └── (player joins world → first-join flow) → Prison phase
        └── (plate press) → FloorActive @ floor 1 (Old Prison theme)
              └── (key in chest → key on exit plate) → Descent cinematic
                    └── FloorActive @ floor 2 (Old Prison theme)
                          └── Descent
                                └── FloorActive @ floor 3 (Depths theme)
                                      └── Descent
                                            └── FloorActive @ floor 4 (Depths theme)
                                                  └── (key on exit plate) → Run Complete → Idle
```

Any floor state branches:
- **Partial death:** dead players enter spectator; surviving players keep running.
- **Total death:** → `GameOver`. `/scriptevent trickymaze:restart` → `Idle`.

## 3. RunState Extensions

Plan 1's `RunState` gains the following fields (all persisted via dynamic properties):

```ts
interface RunState {
  // Existing (Plan 1)
  phase: RunPhase;
  floor: number;
  alive: Set<string>;      // player IDs currently alive
  // New (Plan 2)
  dead: Set<string>;       // player IDs currently dead/spectator
  currentFloor: number;    // 1..4 while in FloorActive; 0 otherwise
  floorSpec: FloorSpec | undefined;  // serialized to a pack of primitive fields
  trackedTickingAreas: string[];     // names we've added, for cleanup
}

enum RunPhase { Idle, Prison, FloorActive, GameOver }  // GameOver added
```

`Descending` is **not** a persisted phase — it's a transient in-memory flag during the cinematic. On reload mid-descent (rare), the phase is still `FloorActive`; the cinematic will not resume. Player may replay the current floor's exit plate to retrigger descent.

`markDead(id)` moves a player ID from `alive` to `dead`. `markAlive(id)` does the reverse. `clearDead()` moves all IDs from `dead` to `alive` (used when restoring spectators on floor completion).

## 4. Module Map

```
src/
  state/
    run.ts                 [modified] add dead set, GameOver phase, floor spec serialization
    persistence.ts         [modified] serialize/deserialize new fields
  floors/                  [NEW directory]
    builder.ts             buildFloor(anchor, floor, theme) → FloorSpec
    themes.ts              theme lookup by floor number
    distance.ts            BFS flood-fill over maze grid
    chest_placement.ts     pick farthest dead-end cell
  descent/                 [NEW directory]
    cinematic.ts           4-second timeline orchestrator
    transition.ts          anchor advance, tickingarea swap, teleport, spectator restore
  events/
    exit_plate.ts          [NEW] poll + inventory check + key consume + fire descent
    death.ts               [modified] partial = spectator, total = GameOver
    first_join.ts          [modified] push prison tickingarea name to trackedTickingAreas; Idle-respawn triggers rebuild
    pressure_plate.ts      [modified] on plate press, call buildFloor(floor 1) instead of triggering free-roam
  main.ts                  [modified] register exit_plate poll, handle restart scriptevent, victory branch, Idle-respawn hook
```

The Plan 1 `buildPrison` stays as-is — it's only used for the prison build. Floor builds go through the new `buildFloor` module. Shared helpers (`whenChunksLoaded`, `fillBlocks`, `applyOps`) stay in their existing locations.

**Prison ticking area tracking:** Plan 1's `handleFirstJoin` adds a ticking area named `tm_prison` but does not record it. Plan 2 modifies `first_join.ts` to push this name to `runState.trackedTickingAreas` after adding the area, so restart (§11.1) and victory (§11.2) cleanly tear it down alongside floor areas.

## 5. Types

### 5.1 FloorSpec

```ts
interface FloorSpec {
  floor: number;              // 1..4
  anchor: Vec3;               // top-NW corner (ground level of maze floor)
  size: number;               // cells per side
  startCell: Cell;            // player spawn cell
  exitCell: Cell;             // iron-door cell
  exitDoorPos: Vec3;          // iron door block position
  exitPlatePos: Vec3;         // pressure plate position (inside exit cell)
  chestPos: Vec3;             // chest position (inside farthest dead-end cell)
  theme: Theme;
  tickingAreaName: string;    // e.g. "tm_floor_2"
}
```

Persisted form: flattened primitives (floor, anchor.x/y/z, size, startCell.row/col, exitCell.row/col, plus explicit Vec3 fields for door/plate/chest, plus theme.id, plus tickingAreaName). No JSON-stringify — dynamic properties are primitives only.

### 5.2 Theme

```ts
interface Theme {
  id: "old_prison" | "depths";
  wall: string;
  floor: string;
  ceiling: string;
}

const THEMES: Record<Theme["id"], Theme> = {
  old_prison: {
    id: "old_prison",
    wall: "minecraft:stone_bricks",
    floor: "minecraft:cobblestone",
    ceiling: "minecraft:stone_bricks",
  },
  depths: {
    id: "depths",
    wall: "minecraft:deepslate_bricks",
    floor: "minecraft:blackstone",
    ceiling: "minecraft:deepslate_tiles",
  },
};

function themeForFloor(n: number): Theme {
  if (n <= 2) return THEMES.old_prison;
  return THEMES.depths;
}
```

### 5.3 Cell (existing; confirming shape)

```ts
interface Cell { row: number; col: number; }
```

## 6. Floor Progression

**Sizing:**
- Floor 1: 12 cells/side
- Floor 2: 16
- Floor 3: 20
- Floor 4: 20 (capped)

Formula: `size = min(20, 12 + (n - 1) * 4)`. Plan 1's 40-cap is reduced to 20 for Plan 2 — four floors already make the run long enough; larger mazes compound chunk-load time.

**Anchor progression:**
- `prisonAnchor = (10000, -50, 10000)` (from Plan 1)
- `FLOOR_DEPTH = 30`
- Floor N anchor = `(10000, -50 - N * 30, 10000)` (i.e., floor 1 at y=-80, floor 2 at y=-110, ..., floor 4 at y=-170)

Each floor's ticking area is added on arrival and removed when leaving (or during restart cleanup). The prison's ticking area is **not** removed when floor 1 builds — prison remains loaded until run completion (preserves the escape state for anyone who joins mid-run via the tolerate-not-teleport rule).

## 7. Maze Generation — Plan 2 Additions

Plan 1's grid carver, `buildPrison`, and `applyOps` stay. New:

### 7.1 `buildFloor(anchor, floor, theme)` — pseudocode

```
1. Compute size from floor number.
2. Carve grid (reuse Plan 1 carver, seeded deterministically or randomly).
3. Pick start cell = (0, 0); pick exit cell = (size-1, size-1) [or any corner opposite start].
4. Compute BFS distances from start cell.
5. Find all dead-end cells (exactly one passage neighbor).
6. Choose chestCell:
     candidates = dead-ends where cell != start
     if candidates contains exitCell AND len(candidates) > 1:
       candidates = candidates without exitCell
     sort by distance desc, then row asc, then col asc
     chestCell = candidates[0]
7. Convert grid to block operations via theme palette (walls, floor, ceiling).
8. Apply operations (gated by whenChunksLoaded on the anchor).
9. Place iron door recessed into the exit cell's far wall (the wall opposite the start direction). Door occupies one cell-width opening in the wall at floor level (2 blocks tall).
10. Place stone pressure plate inside exitCell on the floor, one block toward the start from the door (so players step on it as they approach the door).
11. Place chest at chestCell floor position.
12. Populate chest: container.setItem(0, keyItemStack()).
13. Return FloorSpec.
```

### 7.2 Chest placement rules

- **Must** be a dead-end (exactly one open neighbor in the grid).
- **Must not** be the start cell.
- **Should not** be the exit cell; only allowed if no other dead-end exists (vanishingly rare for size ≥ 12).
- Among valid candidates, choose max-distance by BFS path length; break ties by smallest `(row, col)` lexicographic.

### 7.3 Key item stack

```ts
function keyItemStack(): ItemStack {
  const stack = new ItemStack("minecraft:tripwire_hook", 1);
  stack.nameTag = "§eFloor Key";
  stack.setLore(["§7Opens the exit door"]);
  return stack;
}
```

Detection for consumption: iterate inventory slots; match by `item.typeId === "minecraft:tripwire_hook"` **and** `item.nameTag === "§eFloor Key"`. The nameTag check prevents accidentally consuming vanilla tripwire hooks a player brought into the run (edge case, but cheap to guard).

## 8. Exit Plate Logic

Registered once at script init; active only when `phase === FloorActive` and no cinematic is in flight:

```
every 20 ticks (1 Hz):
  if phase != FloorActive: return
  if descentInFlight: return            // guards against re-trigger mid-cinematic
  spec = runState.floorSpec
  if !spec: return
  platePos = spec.exitPlatePos
  for each alive player:
    if floor(player.location) == platePos:
      if findKey(player.inventory):
        consumeKey(player.inventory)
        openExitDoor(spec.exitDoorPos)
        beginDescent(spec.floor)
        return   // only one trigger per tick
      else:
        if now - noKeyMsgByPlayer.get(player.id, 0) > 20:  // 1s rate limit
          player.sendMessage("§cYou need the floor key.")
          noKeyMsgByPlayer.set(player.id, now)
```

**Rate limit state** is held in-memory per player (a `Map<playerId, number>`), not persisted. Acceptable because worst case after reload is one extra message.

**`openExitDoor(doorPos)`:** replace the block immediately below the door with `minecraft:redstone_block`. Iron doors in Bedrock respond to adjacent redstone power; placing a redstone block directly below opens the door. No need to ever close it — the floor is torn down during transition.

## 9. Descent Cinematic

Triggered by `beginDescent(currentFloor)`. Target audience: all alive players at the moment of trigger.

### 9.1 Timeline (ticks at 20 Hz)

| t (s) | Tick | Action |
|-------|------|--------|
| 0.0 | 0 | Set transient in-memory `descentInFlight = true` (module-level flag in `descent/cinematic.ts`, exported for exit-plate poll to read). Freeze each alive player's movement via `player.inputPermissions.movement = false`. |
| 0.0 | 0 | `overworldDim.runCommand("weather thunder 200")`. |
| 0.2 | 4 | Each alive player: `setTitle("§6Descending…", { subtitle: "§7Floor " + (currentFloor+1), fadeIn: 4, stay: 60, fadeOut: 4 })`. |
| 0.5 | 10 | Each alive player: `playSound("ambient.cave", { volume: 1, pitch: 0.5 })`. |
| 1.5 | 30 | Each alive player: `playSound("mob.wither.spawn", { volume: 0.7, pitch: 0.7 })`. |
| 3.0 | 60 | "Fade" curtain — empty black title via long-stay black char. |
| 3.5 | 70 | **Transition step** (see §9.2). |
| 4.0 | 80 | `overworldDim.runCommand("weather clear")`. `descentInFlight = false`. Phase stays `FloorActive` (it never left). commitState. |

### 9.2 Transition step

1. Remove current floor's ticking area: `runCommand("tickingarea remove " + spec.tickingAreaName)`.
2. If `currentFloor === 4`: run Victory branch (§11.2) and return — do not build floor 5.
3. Compute new anchor: `newAnchor = (prisonAnchor.x, prisonAnchor.y - (currentFloor + 1) * FLOOR_DEPTH, prisonAnchor.z)`.
4. Add new ticking area: `runCommand("tickingarea add " + newAnchor + " " + farCornerOfNextMaze + " tm_floor_" + (currentFloor + 1))`. Push name to `trackedTickingAreas`.
5. `whenChunksLoaded(newAnchor, () => { ... })` — on ready:
   - `newSpec = buildFloor(newAnchor, currentFloor + 1, themeForFloor(currentFloor + 1))`
   - `runState.floorSpec = newSpec; runState.currentFloor = currentFloor + 1; commitState`
   - Teleport all alive players to `newSpec.startCell` floor position.
   - For each player in `runState.dead`:
     - `setGameMode(survival)`
     - `runState.markAlive(playerId)` (implicitly moves from dead to alive)
     - teleport to `newSpec.startCell`
   - After loop: `runState.dead` is empty.
   - For each alive player: `inputPermissions.movement = true`.

### 9.3 Chunk-load failure safety

If `whenChunksLoaded` exhausts its 30 attempts (15s) without chunks loading:
- Log error `[TrickyMaze] Descent transition aborted — new floor chunks never loaded.`
- Force `weather clear`, `inputPermissions.movement = true` for all players, and `descentInFlight = false` so the plate can re-trigger.
- Leave players at their previous positions (still in old floor — now partially unloaded but not torn down; they're effectively stuck but not frozen).
- Phase remains `FloorActive` with old floor spec. Admin can `/scriptevent trickymaze:restart` to recover.

This should not occur under normal conditions; it exists so a network/IO hiccup doesn't permafreeze players. Note that during GameOver the restart handler also resets `descentInFlight` to false defensively.

## 10. Death & Spectator Handling

### 10.1 On death (`entityDie` event)

```
if entity is not Player: return
if phase not in {Prison, FloorActive}: return
playerId = entity.id
runState.markDead(playerId)
commitState
```

### 10.2 On playerSpawn (post-death respawn)

```
if phase not in {Prison, FloorActive}: return
if playerId in runState.dead:
  player.setGameMode(spectator)
  if phase == FloorActive && runState.floorSpec:
    teleport player to runState.floorSpec.startCell floor pos (overhead view of maze)
  else if phase == Prison && prisonSpec:
    teleport player to prison interior center

  // Check total death now that the player has respawned into spectator
  if runState.aliveCount() == 0:
    triggerGameOver()
```

### 10.3 Total death → GameOver

```
phase = RunPhase.GameOver
commitState
for each player: setTitle("§4Run Failed", { subtitle: "§7Floor " + currentFloor + " • All heroes fell" })
world.sendMessage("§7Use /scriptevent trickymaze:restart to begin a new run.")
```

Exit plate poll is guarded by `phase === FloorActive`, so GameOver naturally halts it. No explicit subscription removal needed.

### 10.4 Restore on floor completion

Handled inside the descent transition step (§9.2). Restoring a spectator to survival + teleporting to new floor start is the only place `dead` → `alive` movement occurs during a run.

## 11. End States

### 11.1 GameOver → Restart

Scriptevent `trickymaze:restart`:

```
if phase != RunPhase.GameOver:
  log "[TrickyMaze] restart ignored — phase is " + phase
  return
for each tickingAreaName in runState.trackedTickingAreas:
  runCommand("tickingarea remove " + tickingAreaName)
runState = freshRunState()   // Idle phase, empty sets, no floor spec
commitState
world.sendMessage("§aRun reset. Respawn or relog to begin a new run.")
```

Restart tears down every tracked ticking area (which includes the prison's — see §11.3) and resets state to `Idle`. The prison rebuilds via the Idle-respawn hook defined in §11.3.

### 11.2 Victory (clearing floor 4)

Inside descent transition, when `currentFloor === 4`:

```
for each alive player:
  setTitle("§6§lRun Complete!", { subtitle: "§eYou escaped the maze." })
  playSound("random.levelup", { volume: 1, pitch: 1 })
  playSound("ui.toast.challenge_complete", { volume: 1, pitch: 1 })
for each dead player:
  setGameMode(survival)
  teleport to world spawn
  runState.markAlive(playerId)
for each tickingAreaName in runState.trackedTickingAreas:
  runCommand("tickingarea remove " + tickingAreaName)
runState = freshRunState()
commitState
```

The prison rebuilds via the Idle-respawn hook defined in §11.3 — the first player to respawn, change dimensions, or relog triggers `handleFirstJoin`.

### 11.3 Idle-phase prison rebuild hook

Plan 1's `handleFirstJoin` fires on `playerSpawn` when `phase === Idle` AND `initialSpawn === true`. This misses the "I'm already in the world, we just reset" case.

**Plan 2 change:** the Idle-phase branch of the `playerSpawn` handler calls `handleFirstJoin` on **any** spawn (initial or respawn/dimension-change) when `phase === Idle` and no prison currently exists. A `prisonSpec === undefined` check guards against double-building. This single change covers both the restart path (§11.1) and the victory path (§11.2).

## 12. Error Handling & Edge Cases

- **Mid-run disconnect:** existing Plan 1 rule — on reconnect, `markAlive` in the `playerSpawn` handler moves them back into the run if still in `FloorActive/Prison`. No teleport — they land wherever Bedrock spawns them. The "tolerated, not teleported" rule from Plan 1 code review stands.
- **Mid-run join** (new player never seen before): tolerated, not auto-added to the run roster. They spawn at world spawn in survival. They can manually walk into the maze if they wish (no mechanical effect until they die, at which point they'd get added to `dead` via the normal handler — but this is an edge case we explicitly allow).
- **Spectator reload:** on reload during `FloorActive` with phase preserved, a spectator's gamemode does not persist (Bedrock resets gamemode on reload for non-op players). The `playerSpawn` handler re-applies spectator for anyone in `runState.dead`.
- **Key item stacking:** `tripwire_hook` max stack = 64. The chest places a stack of 1; the inventory matcher iterates all slots so a player carrying multiple keys (impossible in normal flow) would still trigger consumption of exactly one.
- **Player changes inventory while plate poll runs:** acceptable — the next poll (1s later) will re-check. No synchronization needed.
- **Weather already thunder when cinematic starts:** `weather thunder 200` resets the duration; no issue.
- **Descent during prison phase:** impossible — exit plate poll guards on `phase === FloorActive`.

## 13. Testing Strategy

### 13.1 Unit tests (jest)

| File | Covers |
|------|--------|
| `tests/distance.test.ts` | BFS distance on hand-crafted 5×5 grids; unreachable cell returns `Infinity`. |
| `tests/chest_placement.test.ts` | Finds farthest dead-end; falls back correctly when exit is the sole dead-end winner; deterministic tiebreak. |
| `tests/themes.test.ts` | `themeForFloor(1..2) === old_prison`, `themeForFloor(3..4) === depths`, `themeForFloor(5+) === depths`. |
| `tests/run_state.test.ts` | `markDead`, `markAlive`, `clearDead`, `aliveCount`, phase transitions to/from `GameOver`, serialization round-trip of new fields. |
| `tests/floor_spec.test.ts` | `buildFloor` returns self-consistent FloorSpec (startCell ≠ exitCell, chestPos within grid bounds, exitPlatePos adjacent to exitDoorPos). Uses a deterministic seed. |

Target: all 5 new test files passing, plus existing Plan 1 tests unaffected.

### 13.2 QA scenarios (manual, in-game)

Saved to `docs/superpowers/plans/2026-04-19-trickymaze-plan-2-qa.md`:

1. **First floor built:** prison escape → floor 1 appears below, chest visible, exit door + plate visible, theme = Old Prison.
2. **No-key plate attempt:** stand on exit plate with empty inventory → see `§cYou need the floor key.` message, rate-limited to one per second. Door stays closed.
3. **With-key plate:** pick up key from chest, stand on plate → key consumed from inventory (stack decrements from 1 to 0), iron door opens, descent cinematic fires.
4. **Descent → floor 2:** cinematic plays (title, sounds, thunder), land in floor 2 start cell, theme still Old Prison, new chest + key + plate.
5. **Floor 3 theme swap:** complete floor 2 → floor 3 is Depths (deepslate + blackstone). Visual confirmation.
6. **Floor 4 victory:** complete floor 4 → Run Complete title, level-up sound, reset to Idle. Next player spawn rebuilds prison.
7. **Solo death:** die on floor 2 → respawn as spectator above the floor 2 maze.
8. **Co-op partial death:** two players, one dies on floor 3 → dead player spectates, surviving player clears floor → both arrive on floor 4 alive in survival.
9. **Total death:** all players die on floor 2 → GameOver title, chat hint. `/scriptevent trickymaze:restart` → Idle, ticking areas cleaned up, prison rebuilds on next player spawn.
10. **World reload mid-floor:** log out on floor 3, log back in → maze intact, chest position preserved (key item state: if you'd already picked it up, it's still in your inventory), phase still FloorActive, exit plate still active.

## 14. Open Questions

None — all design decisions locked during brainstorming (2026-04-19 session).

## 15. Deferred to Future Plans

- **Plan 3 — Monsters:** hostile mob spawning on floors, gated by theme. Currently `domobspawning = false` for all of Plan 2.
- **Plan 4 — Loot:** additional chests with non-key loot (food, tools, armor). Plan 2 chests hold only the key.
- **Plan 5 — Atmosphere polish:**
  - Decorative accents (iron bars, cobwebs, pointed dripstone, skulls) per theme
  - Custom-pack key item (`trickymaze:floor_key` with custom texture + lang entry)
  - Additional themes: Nether's Edge, Abyss (for floors 5+ in a future scope expansion)
  - Per-floor ambient sounds and light levels
