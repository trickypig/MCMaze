# TrickyMaze Plan 2 — Descent, Keys & Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Plan 1 foundation to a complete 4-floor run: key-gated progression via exit pressure plates, descent cinematic between floors, two themed palettes (Old Prison for floors 1–2, Depths for floors 3–4), spectator-on-death with GameOver/restart flow, and victory reset on clearing floor 4.

**Architecture:** Extends existing `src/generation/` and `src/events/` layers rather than introducing new top-level directories (consistent with Plan 1 code layout). Pure logic (theme palette, chest placement, key item helper, floor spec extension) is added to `src/generation/` with unit tests. Side-effectful event/cinematic logic lives under `src/events/`. RunState gains persistent fields (dead set, currentFloor, tracked ticking areas) and a GameOver phase. The `Descending` enum value is preserved as a real persisted phase during cinematic, and reload-recovery maps it back to FloorActive.

**Tech Stack:** Minecraft Bedrock 1.21.100+, `@minecraft/server` ^2.0.0 (stable), TypeScript 5.x, vitest, Node 20+.

**Spec reference:** `docs/superpowers/specs/2026-04-19-trickymaze-plan-2-design.md`.

---

## Deviations from Spec

The spec (§4) proposes new top-level directories `src/floors/` and `src/descent/`. The existing Plan 1 code uses `src/generation/` for pure building logic and `src/events/` for side-effectful handlers. This plan keeps that layout:

- Theme palettes → `src/generation/themes.ts`
- Fixture placement (door, plate, chest) → `src/generation/fixtures.ts`
- Exit-plate poll → `src/events/exit_plate.ts`
- Descent cinematic + transition → `src/events/descent.ts`
- Restart scriptevent → wired in `src/main.ts` alongside the existing shutdown handler (no new file).

The spec's §9 "descentInFlight in-memory flag" is implemented as `RunPhase.Descending` persisted in state (that enum value already exists). On script init, if phase is Descending (reload mid-cinematic), reset it to FloorActive as a recovery step. This is functionally equivalent to the spec's intent and avoids maintaining two signals.

The spec §5.2 proposes new directory `src/floors/themes.ts`; in this plan the equivalent `src/generation/themes.ts` matches the existing pattern. Same for all other module paths.

---

## Directory Layout After Plan 2

```
maze/
  src/
    main.ts                      [modified]
    state/
      run.ts                     [modified]
      persistence.ts             [modified]
    generation/
      maze.ts                    [unchanged]
      floor.ts                   [unchanged — pure maze carve, no fixtures]
      fixtures.ts                [NEW — door, plate, chest, key item]
      themes.ts                  [NEW — palette lookup]
      prison.ts                  [unchanged]
      rng.ts                     [unchanged]
      world_writer.ts            [unchanged]
    events/
      first_join.ts              [modified — track prison ticking area]
      pressure_plate.ts          [modified — use themed fixtures]
      death.ts                   [modified — drop countdown, use GameOver]
      exit_plate.ts              [NEW — poll + key consume + trigger descent]
      descent.ts                 [NEW — cinematic + transition]
  tests/
    maze.test.ts                 [unchanged]
    run.test.ts                  [modified — add dead set, GameOver, serialization]
    sanity.test.ts               [unchanged]
    themes.test.ts               [NEW]
    fixtures.test.ts             [NEW]
  docs/superpowers/plans/
    2026-04-19-trickymaze-plan-2-descent.md   [THIS FILE]
    2026-04-19-trickymaze-plan-2-qa.md        [NEW — Task 21]
```

---

## Task Index

- Task 1 — RunState: add `dead` set, `GameOver` phase, `currentFloor`, `trackedTickingAreas`
- Task 2 — RunState serialization extensions + loader recovery for `Descending`
- Task 3 — Theme palette + `themeForFloor` lookup
- Task 4 — Key item ID + display-name constants
- Task 5 — Chest placement helper (`pickChestCell`)
- Task 6 — Fixture builder (`buildFixtures`) — iron door, pressure plate, chest
- Task 7 — Update `pressure_plate.ts` (prison plate) to use themed fixtures + track ticking area name
- Task 8 — Update `first_join.ts` to push prison ticking area to `trackedTickingAreas`
- Task 9 — Exit-plate key detection + consume helper
- Task 10 — Exit-plate poll (event handler + main wiring)
- Task 11 — Descent cinematic orchestrator (4-second timeline, title/sound/weather)
- Task 12 — Descent transition (tear down, advance anchor, rebuild, teleport, spectator restore)
- Task 13 — Floor 4 victory branch (inside transition)
- Task 14 — Rework `death.ts`: partial → spectator, total → GameOver (drop countdown)
- Task 15 — Restart scriptevent (`trickymaze:restart`)
- Task 16 — Idle-respawn rebuild hook (prison rebuilds after restart or victory)
- Task 17 — Main wiring: register exit-plate poll, descent state, idle-respawn handler
- Task 18 — Update self-test scriptevent (if present) + content-log sanity
- Task 19 — Update package manifests to version `1.1.0`
- Task 20 — End-to-end smoke build + local deploy verification
- Task 21 — Plan 2 QA checklist document

---

## Task 1: RunState — add dead set, GameOver phase, currentFloor, trackedTickingAreas

**Files:**
- Modify: `src/state/run.ts`
- Modify: `tests/run.test.ts`

- [ ] **Step 1: Write the failing tests** — append to `tests/run.test.ts`:

```ts
describe("RunState — Plan 2 extensions", () => {
  it("tracks a dead set separately from alive", () => {
    const state = new RunState();
    state.enterPrison();
    state.startFloor(1);
    state.markAlive("a");
    state.markAlive("b");
    state.markDead("a");
    expect(state.aliveCount()).toBe(1);
    expect(state.deadCount()).toBe(1);
    expect(state.isDead("a")).toBe(true);
  });

  it("GameOver is reachable via triggerGameOver() when all alive dead", () => {
    const state = new RunState();
    state.enterPrison();
    state.markAlive("a");
    state.startFloor(1);
    state.markDead("a");
    state.triggerGameOver();
    expect(state.phase).toBe(RunPhase.GameOver);
  });

  it("clearDead() moves every dead id back into alive", () => {
    const state = new RunState();
    state.enterPrison();
    state.markAlive("a");
    state.markAlive("b");
    state.startFloor(1);
    state.markDead("a");
    state.clearDead();
    expect(state.aliveCount()).toBe(2);
    expect(state.deadCount()).toBe(0);
    expect(state.isDead("a")).toBe(false);
  });

  it("currentFloor + trackedTickingAreas default to empty", () => {
    const state = new RunState();
    expect(state.currentFloor).toBe(0);
    expect(state.trackedTickingAreas).toEqual([]);
  });

  it("trackTickingArea() deduplicates names", () => {
    const state = new RunState();
    state.trackTickingArea("tm_prison");
    state.trackTickingArea("tm_prison");
    state.trackTickingArea("tm_floor_1");
    expect(state.trackedTickingAreas).toEqual(["tm_prison", "tm_floor_1"]);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm test -- tests/run.test.ts`
Expected: 5 new failures — `deadCount is not a function`, `RunPhase.GameOver is undefined`, etc.

- [ ] **Step 3: Update `src/state/run.ts` to add GameOver, dead set, currentFloor, trackedTickingAreas**

Replace the enum and class body:

```ts
export enum RunPhase {
  Idle = "IDLE",
  Prison = "PRISON",
  FloorActive = "FLOOR_ACTIVE",
  Descending = "DESCENDING",
  GameOver = "GAME_OVER",
  Resetting = "RESETTING",
}

export type RunStateBlob = {
  phase: RunPhase;
  floor: number;
  currentFloor: number;
  trackedTickingAreas: string[];
};

export class RunState {
  phase: RunPhase = RunPhase.Idle;
  floor: number = 0;
  currentFloor: number = 0;
  trackedTickingAreas: string[] = [];

  private alive = new Set<string>();
  private dead = new Set<string>();

  enterPrison(): void {
    this.phase = RunPhase.Prison;
    this.floor = 0;
    this.currentFloor = 0;
  }

  startFloor(n: number): void {
    if (this.phase !== RunPhase.Prison && this.phase !== RunPhase.FloorActive) {
      throw new Error(`Cannot startFloor from ${this.phase}`);
    }
    this.floor = n;
    this.currentFloor = n;
    this.phase = RunPhase.FloorActive;
  }

  beginDescent(): void {
    if (this.phase !== RunPhase.FloorActive) {
      throw new Error(`Cannot beginDescent from ${this.phase}`);
    }
    this.phase = RunPhase.Descending;
  }

  finishDescent(): void {
    this.phase = RunPhase.FloorActive;
  }

  triggerGameOver(): void {
    this.phase = RunPhase.GameOver;
  }

  markAlive(playerId: string): void {
    this.alive.add(playerId);
    this.dead.delete(playerId);
  }

  markDead(playerId: string): void {
    this.alive.delete(playerId);
    this.dead.add(playerId);
  }

  clearDead(): void {
    for (const id of this.dead) {
      this.alive.add(id);
    }
    this.dead.clear();
  }

  isAlive(playerId: string): boolean {
    return this.alive.has(playerId);
  }

  isDead(playerId: string): boolean {
    return this.dead.has(playerId);
  }

  aliveCount(): number {
    return this.alive.size;
  }

  deadCount(): number {
    return this.dead.size;
  }

  aliveIds(): string[] {
    return [...this.alive];
  }

  deadIds(): string[] {
    return [...this.dead];
  }

  trackTickingArea(name: string): void {
    if (!this.trackedTickingAreas.includes(name)) {
      this.trackedTickingAreas.push(name);
    }
  }

  clearTickingAreas(): void {
    this.trackedTickingAreas = [];
  }

  reset(): void {
    this.alive.clear();
    this.dead.clear();
    this.phase = RunPhase.Prison;
    this.floor = 0;
    this.currentFloor = 0;
    this.trackedTickingAreas = [];
  }

  resetToIdle(): void {
    this.alive.clear();
    this.dead.clear();
    this.phase = RunPhase.Idle;
    this.floor = 0;
    this.currentFloor = 0;
    this.trackedTickingAreas = [];
  }

  serialize(): RunStateBlob {
    return {
      phase: this.phase,
      floor: this.floor,
      currentFloor: this.currentFloor,
      trackedTickingAreas: [...this.trackedTickingAreas],
    };
  }

  static hydrate(blob: RunStateBlob): RunState {
    const s = new RunState();
    s.phase = blob.phase;
    s.floor = blob.floor;
    s.currentFloor = blob.currentFloor ?? 0;
    s.trackedTickingAreas = Array.isArray(blob.trackedTickingAreas)
      ? [...blob.trackedTickingAreas]
      : [];
    return s;
  }
}
```

The existing Plan 1 `markDead` auto-transitioned to `Resetting` when the last alive player died. That auto-transition is removed; Task 14 replaces it with an explicit GameOver call from the death handler.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm test -- tests/run.test.ts`
Expected: all RunState tests pass. The old `RESETTING` transition test may fail (`transitions FLOOR_ACTIVE -> RESETTING when last alive dies`) — update it:

```ts
it("markDead moves the id from alive to dead set", () => {
  const state = new RunState();
  state.enterPrison();
  state.markAlive("player-a");
  state.startFloor(1);
  state.markDead("player-a");
  expect(state.isDead("player-a")).toBe(true);
  expect(state.aliveCount()).toBe(0);
  // Phase does NOT auto-change — the event handler drives GameOver.
  expect(state.phase).toBe(RunPhase.FloorActive);
});
```

Replace the old `"transitions FLOOR_ACTIVE -> RESETTING when last alive dies"` test with this one. Re-run — all pass.

- [ ] **Step 5: Commit**

```bash
git add src/state/run.ts tests/run.test.ts
git commit -m "feat(state): add GameOver phase, dead set, ticking area tracking"
```

---

## Task 2: RunState serialization + reload recovery

**Files:**
- Modify: `src/state/persistence.ts`
- Modify: `tests/run.test.ts`

- [ ] **Step 1: Write the failing test** — append to `tests/run.test.ts`:

```ts
describe("RunState serialization — Plan 2", () => {
  it("roundtrips currentFloor and trackedTickingAreas", () => {
    const state = new RunState();
    state.enterPrison();
    state.startFloor(3);
    state.trackTickingArea("tm_prison");
    state.trackTickingArea("tm_floor_3");
    const blob = state.serialize();
    const restored = RunState.hydrate(blob);
    expect(restored.currentFloor).toBe(3);
    expect(restored.trackedTickingAreas).toEqual(["tm_prison", "tm_floor_3"]);
  });

  it("hydrate tolerates missing new fields (backward compat)", () => {
    const blob = { phase: RunPhase.Prison, floor: 0 } as any;
    const restored = RunState.hydrate(blob);
    expect(restored.currentFloor).toBe(0);
    expect(restored.trackedTickingAreas).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify them passing**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm test -- tests/run.test.ts`
Expected: both new tests pass (Task 1's hydrate already handled these fields).

- [ ] **Step 3: Update `src/state/persistence.ts` for Descending-on-reload recovery**

Replace the file:

```ts
import { world } from "@minecraft/server";
import { RunState, type RunStateBlob, RunPhase } from "./run";

const KEY = "trickymaze:run";

export function loadRunState(): RunState {
  const raw = world.getDynamicProperty(KEY);
  if (typeof raw !== "string") {
    return new RunState();
  }
  try {
    const blob = JSON.parse(raw) as RunStateBlob;
    const state = RunState.hydrate(blob);
    // Reload-mid-cinematic recovery: Descending is transient; on reload we
    // can't resume the cinematic, so roll back to FloorActive. Players
    // replay the exit plate to retrigger descent.
    if (state.phase === RunPhase.Descending) {
      state.finishDescent();
      console.warn("[TrickyMaze] Reload mid-descent — phase reset to FloorActive.");
    }
    return state;
  } catch {
    console.warn("[TrickyMaze] Failed to parse RunState — starting fresh.");
    return new RunState();
  }
}

export function saveRunState(state: RunState): void {
  world.setDynamicProperty(KEY, JSON.stringify(state.serialize()));
}

export { RunPhase };
```

- [ ] **Step 4: Typecheck**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run build`
Expected: TypeScript compiles with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/state/persistence.ts tests/run.test.ts
git commit -m "feat(state): serialize new RunState fields, recover from mid-descent reload"
```

---

## Task 3: Theme palette + `themeForFloor` lookup

**Files:**
- Create: `src/generation/themes.ts`
- Create: `tests/themes.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/themes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { themeForFloor, THEMES } from "../src/generation/themes";

describe("themeForFloor", () => {
  it("floors 1-2 use old_prison palette", () => {
    expect(themeForFloor(1).id).toBe("old_prison");
    expect(themeForFloor(2).id).toBe("old_prison");
  });

  it("floors 3-4 use depths palette", () => {
    expect(themeForFloor(3).id).toBe("depths");
    expect(themeForFloor(4).id).toBe("depths");
  });

  it("floor 5+ defaults to depths (safe fallback)", () => {
    expect(themeForFloor(5).id).toBe("depths");
    expect(themeForFloor(99).id).toBe("depths");
  });

  it("THEMES has exactly two entries", () => {
    expect(Object.keys(THEMES).sort()).toEqual(["depths", "old_prison"]);
  });

  it("each theme has wall, floor, ceiling block ids", () => {
    for (const t of Object.values(THEMES)) {
      expect(t.wall).toMatch(/^minecraft:/);
      expect(t.floor).toMatch(/^minecraft:/);
      expect(t.ceiling).toMatch(/^minecraft:/);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm test -- tests/themes.test.ts`
Expected: FAIL — `Cannot find module '../src/generation/themes'`.

- [ ] **Step 3: Create `src/generation/themes.ts`**

```ts
export type ThemeId = "old_prison" | "depths";

export interface Theme {
  id: ThemeId;
  wall: string;
  floor: string;
  ceiling: string;
}

export const THEMES: Record<ThemeId, Theme> = {
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

export function themeForFloor(n: number): Theme {
  if (n <= 2) return THEMES.old_prison;
  return THEMES.depths;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm test -- tests/themes.test.ts`
Expected: all 5 pass.

- [ ] **Step 5: Commit**

```bash
git add src/generation/themes.ts tests/themes.test.ts
git commit -m "feat(generation): add theme palette + themeForFloor lookup"
```

---

## Task 4: Key item constants

**Files:**
- Create: `src/generation/key_item.ts`
- Create: `tests/key_item.test.ts`

The key is a renamed `minecraft:tripwire_hook` with display name `§eFloor Key`. Extracting the constants into their own file keeps the detector code (Task 9) and the placement code (Task 6) sharing a single source of truth.

- [ ] **Step 1: Write the failing test** — create `tests/key_item.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { KEY_ITEM_TYPE, KEY_DISPLAY_NAME, KEY_LORE } from "../src/generation/key_item";

describe("key item constants", () => {
  it("uses tripwire_hook type", () => {
    expect(KEY_ITEM_TYPE).toBe("minecraft:tripwire_hook");
  });

  it("has a colored display name starting with §e", () => {
    expect(KEY_DISPLAY_NAME).toBe("§eFloor Key");
  });

  it("has lore text", () => {
    expect(KEY_LORE).toEqual(["§7Opens the exit door"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm test -- tests/key_item.test.ts`
Expected: FAIL — `Cannot find module`.

- [ ] **Step 3: Create `src/generation/key_item.ts`**

```ts
export const KEY_ITEM_TYPE = "minecraft:tripwire_hook";
export const KEY_DISPLAY_NAME = "§eFloor Key";
export const KEY_LORE: string[] = ["§7Opens the exit door"];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm test -- tests/key_item.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/generation/key_item.ts tests/key_item.test.ts
git commit -m "feat(generation): add floor key item constants"
```

---

## Task 5: Chest placement helper — `pickChestCell`

**Files:**
- Create: `src/generation/chest_placement.ts`
- Create: `tests/chest_placement.test.ts`

The maze module (`src/generation/maze.ts`) already exposes `maze.deadEnds: Coord[]` and `maze.bfsDistance(cell)`. The helper picks the dead-end farthest from entrance, excluding the exit unless it's the only remaining candidate.

- [ ] **Step 1: Write the failing test** — create `tests/chest_placement.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateMaze } from "../src/generation/maze";
import { pickChestCell } from "../src/generation/chest_placement";

function seededRng(seed: number): () => number {
  let s = seed | 0;
  if (s === 0) s = 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

describe("pickChestCell", () => {
  it("returns a dead-end cell that is not the entrance", () => {
    const maze = generateMaze(8, 8, seededRng(100));
    const chest = pickChestCell(maze);
    expect(maze.deadEnds.some((d) => d.x === chest.x && d.y === chest.y)).toBe(true);
    expect(chest).not.toEqual(maze.entrance);
  });

  it("avoids the exit cell when other dead-ends exist", () => {
    const maze = generateMaze(10, 10, seededRng(200));
    // The 10x10 seed produces multiple dead-ends; exit is also a dead-end.
    const chest = pickChestCell(maze);
    if (maze.deadEnds.length > 1) {
      expect(chest).not.toEqual(maze.exit);
    }
  });

  it("picks the highest bfsDistance dead-end (farthest from entrance)", () => {
    const maze = generateMaze(10, 10, seededRng(300));
    const chest = pickChestCell(maze);
    const chestDist = maze.bfsDistance(chest);
    for (const d of maze.deadEnds) {
      if (d.x === maze.exit.x && d.y === maze.exit.y) continue;
      expect(maze.bfsDistance(d)).toBeLessThanOrEqual(chestDist);
    }
  });

  it("ties are broken deterministically by (x, y) ascending", () => {
    // Build a maze and verify the same maze produces the same chest.
    const a = pickChestCell(generateMaze(10, 10, seededRng(300)));
    const b = pickChestCell(generateMaze(10, 10, seededRng(300)));
    expect(a).toEqual(b);
  });

  it("falls back to exit when no other dead-end exists", () => {
    // Smallest maze guaranteed to have only one dead-end (exit).
    const maze = generateMaze(2, 2, seededRng(1));
    const chest = pickChestCell(maze);
    // With only 4 cells, deadEnds may be exit only — chest should still be a dead-end.
    expect(maze.deadEnds.some((d) => d.x === chest.x && d.y === chest.y)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm test -- tests/chest_placement.test.ts`
Expected: FAIL — `Cannot find module`.

- [ ] **Step 3: Create `src/generation/chest_placement.ts`**

```ts
import type { Coord, Maze } from "./maze";

/**
 * Pick the chest cell: farthest dead-end from the entrance, excluding the
 * exit cell unless it is the only remaining candidate. Ties are broken by
 * (x, y) ascending for determinism.
 */
export function pickChestCell(maze: Maze): Coord {
  const candidates = maze.deadEnds.filter(
    (c) => !(c.x === maze.entrance.x && c.y === maze.entrance.y),
  );
  if (candidates.length === 0) {
    // Empty fallback — shouldn't happen for width/height >= 2, but guard.
    return maze.exit;
  }

  const nonExit = candidates.filter(
    (c) => !(c.x === maze.exit.x && c.y === maze.exit.y),
  );
  const pool = nonExit.length > 0 ? nonExit : candidates;

  let best = pool[0];
  let bestDist = maze.bfsDistance(best);
  for (let i = 1; i < pool.length; i++) {
    const c = pool[i];
    const d = maze.bfsDistance(c);
    if (d > bestDist) {
      best = c;
      bestDist = d;
    } else if (d === bestDist) {
      if (c.x < best.x || (c.x === best.x && c.y < best.y)) {
        best = c;
      }
    }
  }
  return best;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm test -- tests/chest_placement.test.ts`
Expected: all 5 pass.

- [ ] **Step 5: Commit**

```bash
git add src/generation/chest_placement.ts tests/chest_placement.test.ts
git commit -m "feat(generation): pickChestCell — farthest dead-end, exit excluded"
```

---

## Task 6: Fixture builder — door, plate, chest, key item stack

**Files:**
- Create: `src/generation/fixtures.ts`
- Create: `tests/fixtures.test.ts`

`buildFloor` in `src/generation/floor.ts` is kept pure (maze carve only). A wrapper `buildFixtures` computes the exit door position, exit plate position, chest position, and returns a `FloorFixtures` object plus extra `FillOp`s to merge with the floor's wall operations. Placing the key item in the chest is deferred to runtime (Task 12) because `ItemStack` is a Minecraft API type not available at unit-test time.

- [ ] **Step 1: Write the failing test** — create `tests/fixtures.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateMaze } from "../src/generation/maze";
import { buildFloor } from "../src/generation/floor";
import { buildFixtures } from "../src/generation/fixtures";
import { themeForFloor } from "../src/generation/themes";

function seededRng(seed: number): () => number {
  let s = seed | 0;
  if (s === 0) s = 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

describe("buildFixtures", () => {
  it("places an iron door, pressure plate, and chest inside the floor bounds", () => {
    const maze = generateMaze(8, 8, seededRng(42));
    const theme = themeForFloor(1);
    const anchor = { x: 0, y: -50, z: 0 };
    const floor = buildFloor(maze, {
      anchor,
      wallBlock: theme.wall,
      floorBlock: theme.floor,
      ceilingBlock: theme.ceiling,
    });
    const fx = buildFixtures(maze, floor, anchor);
    const within = (p: { x: number; y: number; z: number }) =>
      p.x >= floor.bounds.min.x &&
      p.x <= floor.bounds.max.x &&
      p.z >= floor.bounds.min.z &&
      p.z <= floor.bounds.max.z;
    expect(within(fx.exitDoorPos)).toBe(true);
    expect(within(fx.exitPlatePos)).toBe(true);
    expect(within(fx.chestPos)).toBe(true);
  });

  it("places the plate adjacent to the door (manhattan distance 1)", () => {
    const maze = generateMaze(6, 6, seededRng(7));
    const anchor = { x: 100, y: -80, z: 200 };
    const floor = buildFloor(maze, {
      anchor,
      wallBlock: "minecraft:stone_bricks",
      floorBlock: "minecraft:cobblestone",
      ceilingBlock: "minecraft:stone_bricks",
    });
    const fx = buildFixtures(maze, floor, anchor);
    const dx = Math.abs(fx.exitDoorPos.x - fx.exitPlatePos.x);
    const dz = Math.abs(fx.exitDoorPos.z - fx.exitPlatePos.z);
    expect(dx + dz).toBe(1);
    expect(fx.exitDoorPos.y).toBe(fx.exitPlatePos.y);
  });

  it("emits FillOps for iron door block, pressure plate block, chest block, and redstone block below door", () => {
    const maze = generateMaze(6, 6, seededRng(5));
    const anchor = { x: 0, y: -50, z: 0 };
    const floor = buildFloor(maze, {
      anchor,
      wallBlock: "minecraft:stone_bricks",
      floorBlock: "minecraft:cobblestone",
      ceilingBlock: "minecraft:stone_bricks",
    });
    const fx = buildFixtures(maze, floor, anchor);
    const blocks = fx.operations.map((o) => o.block);
    expect(blocks).toContain("minecraft:iron_door");
    expect(blocks).toContain("minecraft:stone_pressure_plate");
    expect(blocks).toContain("minecraft:chest");
  });

  it("chest position is on the floor y (anchor.y + 1)", () => {
    const maze = generateMaze(8, 8, seededRng(99));
    const anchor = { x: 0, y: -50, z: 0 };
    const floor = buildFloor(maze, {
      anchor,
      wallBlock: "minecraft:stone_bricks",
      floorBlock: "minecraft:cobblestone",
      ceilingBlock: "minecraft:stone_bricks",
    });
    const fx = buildFixtures(maze, floor, anchor);
    expect(fx.chestPos.y).toBe(anchor.y + 1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm test -- tests/fixtures.test.ts`
Expected: FAIL — `Cannot find module '../src/generation/fixtures'`.

- [ ] **Step 3: Create `src/generation/fixtures.ts`**

```ts
import type { Coord, Maze } from "./maze";
import type { FillOp, FloorSpec, Vec3 } from "./floor";
import { pickChestCell } from "./chest_placement";

export interface FloorFixtures {
  exitDoorPos: Vec3;
  exitPlatePos: Vec3;
  chestPos: Vec3;
  operations: FillOp[];
}

/**
 * Compute fixture positions (door, plate, chest) for a generated maze floor
 * and return the FillOps needed to place them. The `buildFloor` operations
 * should be applied first; these fixture ops overwrite specific cells.
 *
 * Door placement: the exit cell's center (entranceBlock/exitBlock coords are
 * the block-space centers of those cells). Plate is placed one block toward
 * the entrance along whichever axis separates the exit cell from its
 * single open neighbor. A redstone block is placed directly below the door
 * to power it open when fixture ops apply (Task 12 will swap it in only
 * after the key is consumed — at build time we place the door closed and a
 * non-redstone block below).
 */
export function buildFixtures(
  maze: Maze,
  floor: FloorSpec,
  anchor: Vec3,
): FloorFixtures {
  const doorCell = maze.exit;
  const doorPos: Vec3 = cellCenter(doorCell, anchor);

  // Find the single open neighbor of the exit cell; plate goes toward it.
  const walls = maze.cells[doorCell.x][doorCell.y].walls;
  const openNeighborOffset = (() => {
    if (!walls.N) return { dx: 0, dz: -3 };
    if (!walls.S) return { dx: 0, dz: 3 };
    if (!walls.E) return { dx: 3, dz: 0 };
    if (!walls.W) return { dx: -3, dz: 0 };
    return { dx: 0, dz: -3 };
  })();
  // Plate: one block from door along the passage direction.
  const platePos: Vec3 = {
    x: doorPos.x + Math.sign(openNeighborOffset.dx),
    y: doorPos.y,
    z: doorPos.z + Math.sign(openNeighborOffset.dz),
  };

  const chestCell: Coord = pickChestCell(maze);
  const chestPos: Vec3 = cellCenter(chestCell, anchor);

  const ops: FillOp[] = [
    // Clear the door cell's air column (in case carver left walls).
    {
      min: { x: doorPos.x, y: doorPos.y, z: doorPos.z },
      max: { x: doorPos.x, y: doorPos.y + 1, z: doorPos.z },
      block: "minecraft:air",
    },
    // Iron door (lower half). Upper half auto-placed by Bedrock.
    {
      min: { x: doorPos.x, y: doorPos.y, z: doorPos.z },
      max: { x: doorPos.x, y: doorPos.y, z: doorPos.z },
      block: "minecraft:iron_door",
    },
    // Pressure plate one block away toward the passage.
    {
      min: { x: platePos.x, y: platePos.y, z: platePos.z },
      max: { x: platePos.x, y: platePos.y, z: platePos.z },
      block: "minecraft:stone_pressure_plate",
    },
    // Chest at the chosen dead-end cell's center.
    {
      min: { x: chestPos.x, y: chestPos.y, z: chestPos.z },
      max: { x: chestPos.x, y: chestPos.y, z: chestPos.z },
      block: "minecraft:chest",
    },
  ];

  return {
    exitDoorPos: doorPos,
    exitPlatePos: platePos,
    chestPos,
    operations: ops,
  };
}

function cellCenter(cell: Coord, anchor: Vec3): Vec3 {
  return {
    x: anchor.x + cell.x * 3 + 2,
    y: anchor.y + 1,
    z: anchor.z + cell.y * 3 + 2,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm test -- tests/fixtures.test.ts`
Expected: all 4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/generation/fixtures.ts tests/fixtures.test.ts
git commit -m "feat(generation): fixture builder for door, plate, chest"
```

---

## Task 7: Update prison-plate handler to use themed fixtures + track ticking area

**Files:**
- Modify: `src/events/pressure_plate.ts`

The existing handler builds a floor with hard-coded `stone_bricks` palette and no fixtures. Update to use `themeForFloor(1)` and apply fixture ops. Also populate the chest with the key item, and add a ticking area for the new floor.

- [ ] **Step 1: Replace `src/events/pressure_plate.ts`**

```ts
import { world, GameMode, system, ItemStack } from "@minecraft/server";
import { ANCHOR, prisonSpec } from "./first_join";
import { RunPhase, type RunState } from "../state/run";
import { buildFloor } from "../generation/floor";
import { generateMaze } from "../generation/maze";
import { applyOps } from "../generation/world_writer";
import { commitState } from "../main";
import { worldSeededRng } from "../generation/rng";
import { themeForFloor } from "../generation/themes";
import { buildFixtures } from "../generation/fixtures";
import { KEY_ITEM_TYPE, KEY_DISPLAY_NAME, KEY_LORE } from "../generation/key_item";
import type { FloorFixtures } from "../generation/fixtures";

const FLOOR_DEPTH = 30;
const FLOOR_Y_SPAN_PAD = 5;

export interface ActiveFloor {
  floor: number;
  anchor: { x: number; y: number; z: number };
  fixtures: FloorFixtures;
  tickingAreaName: string;
  size: number;
}

export let activeFloor: ActiveFloor | null = null;

export function setActiveFloor(f: ActiveFloor | null): void {
  activeFloor = f;
}

export function handlePressurePlate(state: RunState): void {
  if (state.phase !== RunPhase.Prison) return;
  if (!prisonSpec) {
    console.warn("[TrickyMaze] Pressure plate pressed but prison not built yet.");
    return;
  }

  const floorNum = 1; // Prison plate always starts floor 1.
  buildAndEnterFloor(state, floorNum);
}

/**
 * Shared builder used by both the prison plate (entering floor 1) and the
 * descent transition (entering floor N+1).
 */
export function buildAndEnterFloor(state: RunState, floorNum: number): void {
  const size = Math.min(20, 12 + (floorNum - 1) * 4);
  const rng = worldSeededRng(floorNum);
  const maze = generateMaze(size, size, rng);

  const theme = themeForFloor(floorNum);
  const anchor = {
    x: ANCHOR.x,
    y: ANCHOR.y - FLOOR_DEPTH * floorNum,
    z: ANCHOR.z,
  };

  const floorSpec = buildFloor(maze, {
    anchor,
    wallBlock: theme.wall,
    floorBlock: theme.floor,
    ceilingBlock: theme.ceiling,
  });
  applyOps(floorSpec.operations);

  const fixtures = buildFixtures(maze, floorSpec, anchor);
  applyOps(fixtures.operations);

  // Place the key in the chest (runtime-only; not part of fixture ops).
  placeKeyInChest(fixtures.chestPos);

  // Register ticking area for this floor so chunks stay resident.
  const tickingAreaName = `tm_floor_${floorNum}`;
  const dim = world.getDimension("overworld");
  try {
    dim.runCommand(`tickingarea remove ${tickingAreaName}`);
  } catch {
    /* no existing area */
  }
  dim.runCommand(
    `tickingarea add ${anchor.x - FLOOR_Y_SPAN_PAD} ${anchor.y - FLOOR_Y_SPAN_PAD} ${anchor.z - FLOOR_Y_SPAN_PAD} ` +
      `${floorSpec.bounds.max.x + FLOOR_Y_SPAN_PAD} ${floorSpec.bounds.max.y + FLOOR_Y_SPAN_PAD} ${floorSpec.bounds.max.z + FLOOR_Y_SPAN_PAD} ` +
      `${tickingAreaName} true`,
  );
  state.trackTickingArea(tickingAreaName);

  state.startFloor(floorNum);

  setActiveFloor({
    floor: floorNum,
    anchor,
    fixtures,
    tickingAreaName,
    size,
  });

  commitState();

  // Teleport every alive player to the entrance.
  const entrance = floorSpec.entranceBlock;
  for (const p of world.getAllPlayers()) {
    if (!state.isAlive(p.id)) continue;
    p.teleport(
      { x: entrance.x + 0.5, y: entrance.y, z: entrance.z + 0.5 },
      { dimension: dim },
    );
    p.setGameMode(GameMode.Adventure);
  }

  world.sendMessage(`§6You descend into the maze. Floor ${floorNum}.`);
}

function placeKeyInChest(pos: { x: number; y: number; z: number }): void {
  const dim = world.getDimension("overworld");
  const block = dim.getBlock(pos);
  if (!block) {
    console.warn(`[TrickyMaze] Could not place key — chest block not found at ${pos.x},${pos.y},${pos.z}`);
    return;
  }
  const container = block.getComponent("minecraft:inventory")?.container;
  if (!container) {
    console.warn("[TrickyMaze] Chest has no inventory container.");
    return;
  }
  const stack = new ItemStack(KEY_ITEM_TYPE, 1);
  stack.nameTag = KEY_DISPLAY_NAME;
  stack.setLore(KEY_LORE);
  container.setItem(0, stack);
}
```

**Note:** The chest-block-component lookup may race the fill op (Bedrock sometimes does not resolve the container immediately). If key placement fails in testing, wrap `placeKeyInChest(...)` in `system.runTimeout(() => placeKeyInChest(...), 10)` to defer by 10 ticks.

- [ ] **Step 2: Typecheck**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run build`
Expected: TypeScript compiles. `ItemStack`, `setItem`, `setLore` are all stable-API in `@minecraft/server` ^2.0.0.

- [ ] **Step 3: Verify existing tests still pass**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm test`
Expected: all pre-existing tests pass (no tests exercise `pressure_plate.ts` directly).

- [ ] **Step 4: Commit**

```bash
git add src/events/pressure_plate.ts
git commit -m "feat(events): themed floor build with fixtures, track ticking area"
```

---

## Task 8: Track prison ticking area in RunState

**Files:**
- Modify: `src/events/first_join.ts`

- [ ] **Step 1: Update `handleFirstJoin` to track the prison ticking area**

Find the block in `src/events/first_join.ts` where `tickingarea add` is called. After the `dim.runCommand('tickingarea add ...')` call, add:

```ts
state.trackTickingArea(TICKING_AREA_NAME);
```

Immediately before `whenChunksLoaded(ANCHOR, () => {`.

Final relevant section:

```ts
dim.runCommand(
  `tickingarea add ${ANCHOR.x - 10} ${ANCHOR.y - FLOOR_Y_SPAN} ${ANCHOR.z - 10} ` +
    `${ANCHOR.x + 140} ${ANCHOR.y + 10} ${ANCHOR.z + 140} ${TICKING_AREA_NAME} true`,
);
state.trackTickingArea(TICKING_AREA_NAME);

// Disable natural mob spawning world-wide for this session (§9.1).
dim.runCommand("gamerule domobspawning false");
```

- [ ] **Step 2: Typecheck**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run build`
Expected: compiles.

- [ ] **Step 3: Run full test suite**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/events/first_join.ts
git commit -m "feat(events): track prison ticking area in RunState"
```

---

## Task 9: Key detection + consume helper

**Files:**
- Create: `src/events/key_inventory.ts`

This is a pure helper that takes a Container (Bedrock API type) and returns whether a key is present, plus a consume function. Because Container is a Minecraft-API type, the module is not unit-testable from node — keep it small and rely on in-game QA.

- [ ] **Step 1: Create `src/events/key_inventory.ts`**

```ts
import type { Container, Player } from "@minecraft/server";
import { KEY_ITEM_TYPE, KEY_DISPLAY_NAME } from "../generation/key_item";

/**
 * Returns the slot index holding a Floor Key, or -1 if none found.
 * Matches on both item type and display name, so stray vanilla
 * tripwire hooks are not consumed.
 */
export function findKeySlot(container: Container): number {
  for (let i = 0; i < container.size; i++) {
    const stack = container.getItem(i);
    if (!stack) continue;
    if (stack.typeId !== KEY_ITEM_TYPE) continue;
    if (stack.nameTag !== KEY_DISPLAY_NAME) continue;
    return i;
  }
  return -1;
}

/**
 * Remove exactly one key from the player's inventory (from the first
 * matching slot). No-op if the player has no key.
 */
export function consumeKey(player: Player): boolean {
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return false;
  const slot = findKeySlot(container);
  if (slot === -1) return false;
  const stack = container.getItem(slot);
  if (!stack) return false;
  if (stack.amount <= 1) {
    container.setItem(slot, undefined);
  } else {
    stack.amount = stack.amount - 1;
    container.setItem(slot, stack);
  }
  return true;
}

/**
 * Lightweight read-only check; used by the plate poll to decide between
 * triggering descent vs. showing the "you need a key" message.
 */
export function playerHasKey(player: Player): boolean {
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return false;
  return findKeySlot(container) !== -1;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add src/events/key_inventory.ts
git commit -m "feat(events): key detection + consume helper"
```

---

## Task 10: Exit-plate poll event handler

**Files:**
- Create: `src/events/exit_plate.ts`

- [ ] **Step 1: Create `src/events/exit_plate.ts`**

```ts
import { world, system, Player } from "@minecraft/server";
import { RunPhase, type RunState } from "../state/run";
import { activeFloor } from "./pressure_plate";
import { playerHasKey, consumeKey } from "./key_inventory";
import { beginDescent, isDescentInFlight } from "./descent";

const NO_KEY_MSG_COOLDOWN_TICKS = 20; // 1 second
const noKeyMsgByPlayer = new Map<string, number>();

export function registerExitPlatePoll(state: RunState): void {
  system.runInterval(() => {
    if (state.phase !== RunPhase.FloorActive) return;
    if (isDescentInFlight()) return;
    if (!activeFloor) return;
    const plate = activeFloor.fixtures.exitPlatePos;

    for (const p of world.getAllPlayers()) {
      if (!state.isAlive(p.id)) continue;
      const loc = p.location;
      if (
        Math.floor(loc.x) !== plate.x ||
        Math.floor(loc.y) !== plate.y ||
        Math.floor(loc.z) !== plate.z
      ) {
        continue;
      }
      if (playerHasKey(p)) {
        handleKeyedStep(state, p);
        return; // only one trigger per tick
      } else {
        maybeSendNoKeyMessage(p);
      }
    }
  }, 20);
}

function handleKeyedStep(state: RunState, player: Player): void {
  consumeKey(player);
  openExitDoor();
  beginDescent(state);
}

function openExitDoor(): void {
  if (!activeFloor) return;
  const doorPos = activeFloor.fixtures.exitDoorPos;
  const dim = world.getDimension("overworld");
  // Place a redstone block directly below the door to open it.
  dim.runCommand(
    `setblock ${doorPos.x} ${doorPos.y - 1} ${doorPos.z} minecraft:redstone_block`,
  );
}

function maybeSendNoKeyMessage(player: Player): void {
  const now = system.currentTick;
  const last = noKeyMsgByPlayer.get(player.id) ?? 0;
  if (now - last < NO_KEY_MSG_COOLDOWN_TICKS) return;
  player.sendMessage("§cYou need the floor key.");
  noKeyMsgByPlayer.set(player.id, now);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run build`
Expected: compiles. `beginDescent` and `isDescentInFlight` are forward-references to Task 11 — if the build fails because `descent.ts` doesn't exist yet, add a temporary stub file or do Task 11 first then return here.

If you hit missing-module errors, complete Task 11 first, then finish Task 10's build check.

- [ ] **Step 3: Commit**

```bash
git add src/events/exit_plate.ts
git commit -m "feat(events): exit plate poll + key consume trigger"
```

---

## Task 11: Descent cinematic orchestrator

**Files:**
- Create: `src/events/descent.ts`

Contains `beginDescent(state)`, `isDescentInFlight()`, and the 4-second timeline. The transition step (Task 12) is dispatched at t=70 ticks inside this module.

- [ ] **Step 1: Create `src/events/descent.ts`**

```ts
import { world, system, Player } from "@minecraft/server";
import { RunPhase, type RunState } from "../state/run";
import { activeFloor } from "./pressure_plate";
import { runDescentTransition } from "./descent_transition";
import { commitState } from "../main";

let descentInFlight = false;

export function isDescentInFlight(): boolean {
  return descentInFlight;
}

/**
 * Kick off the 4-second cinematic. Callers (exit-plate poll) must have
 * already consumed the key and opened the door. This sets Descending phase,
 * schedules all cinematic beats, and hands off to the transition at t=70.
 */
export function beginDescent(state: RunState): void {
  if (descentInFlight) return;
  if (!activeFloor) return;
  descentInFlight = true;

  state.beginDescent();
  commitState();

  const dim = world.getDimension("overworld");
  const currentFloor = activeFloor.floor;
  const alivePlayers = [...world.getAllPlayers()].filter((p) => state.isAlive(p.id));

  // t=0: freeze alive players + start thunder.
  for (const p of alivePlayers) freezePlayer(p);
  try {
    dim.runCommand("weather thunder 200");
  } catch {
    /* weather command can fail on worlds with gamerule doweathercycle false — ignore */
  }

  // t=4: title.
  system.runTimeout(() => {
    for (const p of alivePlayers) {
      p.onScreenDisplay.setTitle("§6Descending…", {
        subtitle: `§7Floor ${currentFloor + 1}`,
        fadeInDuration: 4,
        stayDuration: 60,
        fadeOutDuration: 4,
      });
    }
  }, 4);

  // t=10: ambient cave.
  system.runTimeout(() => {
    for (const p of alivePlayers) {
      try {
        p.playSound("ambient.cave", { volume: 1, pitch: 0.5 });
      } catch { /* unknown sound — ignore */ }
    }
  }, 10);

  // t=30: wither rumble.
  system.runTimeout(() => {
    for (const p of alivePlayers) {
      try {
        p.playSound("mob.wither.spawn", { volume: 0.7, pitch: 0.7 });
      } catch { /* ignore */ }
    }
  }, 30);

  // t=60: black-curtain title.
  system.runTimeout(() => {
    for (const p of alivePlayers) {
      p.onScreenDisplay.setTitle("§0 ", {
        subtitle: "§0 ",
        fadeInDuration: 10,
        stayDuration: 20,
        fadeOutDuration: 10,
      });
    }
  }, 60);

  // t=70: transition.
  system.runTimeout(() => {
    runDescentTransition(state, () => {
      // Completion callback — runs after transition resolves.
      system.runTimeout(() => {
        try { dim.runCommand("weather clear"); } catch { /* ignore */ }
        descentInFlight = false;
        state.finishDescent();
        commitState();
        for (const p of [...world.getAllPlayers()].filter((p) => state.isAlive(p.id))) {
          unfreezePlayer(p);
        }
      }, 10); // t=80 relative to cinematic start
    });
  }, 70);
}

function freezePlayer(player: Player): void {
  try {
    player.inputPermissions.movement = false;
  } catch { /* API missing on older clients — fall through */ }
}

function unfreezePlayer(player: Player): void {
  try {
    player.inputPermissions.movement = true;
  } catch { /* ignore */ }
}

/**
 * Emergency reset used by the chunk-load-failure path and the restart
 * scriptevent — clear the in-flight flag and unfreeze everyone.
 */
export function abortDescent(state: RunState): void {
  descentInFlight = false;
  for (const p of world.getAllPlayers()) unfreezePlayer(p);
  try {
    world.getDimension("overworld").runCommand("weather clear");
  } catch { /* ignore */ }
  if (state.phase === RunPhase.Descending) state.finishDescent();
}
```

- [ ] **Step 2: Typecheck**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run build`
Expected: compiles once `descent_transition.ts` is created in Task 12. If build fails on the missing import, create a stub `src/events/descent_transition.ts` containing `export function runDescentTransition(state: any, done: () => void): void { done(); }` and revisit after Task 12.

- [ ] **Step 3: Commit**

```bash
git add src/events/descent.ts
git commit -m "feat(events): descent cinematic orchestrator"
```

---

## Task 12: Descent transition — teardown, advance, rebuild, teleport, spectator restore

**Files:**
- Create: `src/events/descent_transition.ts`

- [ ] **Step 1: Create `src/events/descent_transition.ts`**

```ts
import { world, system, GameMode, Player } from "@minecraft/server";
import { RunPhase, type RunState } from "../state/run";
import { activeFloor, buildAndEnterFloor } from "./pressure_plate";
import { ANCHOR } from "./first_join";

const CHUNK_WAIT_TICKS = 10;
const CHUNK_WAIT_MAX_ATTEMPTS = 30;
const MAX_FLOOR = 4;
const FLOOR_DEPTH = 30;

/**
 * Execute the transition step of the descent cinematic.
 *  - Tear down current floor's ticking area
 *  - Branch: floor 4 → victory
 *  - Otherwise: advance anchor, add ticking area, poll for chunk load, build next floor
 *  - After build: teleport all alive players + restore spectators to survival + teleport
 *  - Call `done()` when the transition is complete (success or failure).
 */
export function runDescentTransition(state: RunState, done: () => void): void {
  if (!activeFloor) {
    done();
    return;
  }

  const dim = world.getDimension("overworld");
  const leavingFloor = activeFloor.floor;

  // Tear down the current floor's ticking area.
  try {
    dim.runCommand(`tickingarea remove ${activeFloor.tickingAreaName}`);
  } catch { /* ignore */ }
  state.trackedTickingAreas = state.trackedTickingAreas.filter(
    (n) => n !== activeFloor!.tickingAreaName,
  );

  if (leavingFloor >= MAX_FLOOR) {
    runVictory(state);
    done();
    return;
  }

  const nextFloor = leavingFloor + 1;
  const nextAnchor = {
    x: ANCHOR.x,
    y: ANCHOR.y - FLOOR_DEPTH * nextFloor,
    z: ANCHOR.z,
  };

  // Add the new floor's ticking area before polling for chunk load.
  const nextTickingAreaName = `tm_floor_${nextFloor}`;
  try {
    dim.runCommand(`tickingarea remove ${nextTickingAreaName}`);
  } catch { /* ignore */ }
  dim.runCommand(
    `tickingarea add ${nextAnchor.x - 5} ${nextAnchor.y - 5} ${nextAnchor.z - 5} ` +
      `${nextAnchor.x + 125} ${nextAnchor.y + 10} ${nextAnchor.z + 125} ` +
      `${nextTickingAreaName} true`,
  );
  state.trackTickingArea(nextTickingAreaName);

  whenChunksLoaded(nextAnchor, (ok) => {
    if (!ok) {
      console.warn("[TrickyMaze] Descent transition aborted — new floor chunks never loaded.");
      done();
      return;
    }
    // Remove the pre-added area — buildAndEnterFloor will re-add it with the
    // final bounds. Otherwise we'd have two tickingareas with the same name.
    try {
      dim.runCommand(`tickingarea remove ${nextTickingAreaName}`);
    } catch { /* ignore */ }
    state.trackedTickingAreas = state.trackedTickingAreas.filter(
      (n) => n !== nextTickingAreaName,
    );

    buildAndEnterFloor(state, nextFloor);

    // Teleport + restore every player (alive + dead) to the new floor start.
    const spec = activeFloor;
    if (!spec) { done(); return; }
    const startPos = {
      x: spec.anchor.x + 2.5, // cellCenter of (0,0) = anchor + 2 blocks
      y: spec.anchor.y + 1,
      z: spec.anchor.z + 2.5,
    };
    const wasDead = state.deadIds();
    for (const id of wasDead) {
      const p = findPlayerById(id);
      if (!p) continue;
      p.setGameMode(GameMode.Adventure);
      p.teleport(startPos, { dimension: dim });
    }
    state.clearDead();
    for (const p of [...world.getAllPlayers()].filter((p) => state.isAlive(p.id))) {
      p.teleport(startPos, { dimension: dim });
    }

    done();
  });
}

/**
 * Victory branch: floor 4 cleared. Show Run Complete, play sounds, reset to Idle.
 */
function runVictory(state: RunState): void {
  const dim = world.getDimension("overworld");

  for (const p of world.getAllPlayers()) {
    p.onScreenDisplay.setTitle("§6§lRun Complete!", {
      subtitle: "§eYou escaped the maze.",
      fadeInDuration: 10,
      stayDuration: 80,
      fadeOutDuration: 10,
    });
    try { p.playSound("random.levelup", { volume: 1, pitch: 1 }); } catch { /* ignore */ }
    try { p.playSound("ui.toast.challenge_complete", { volume: 1, pitch: 1 }); } catch { /* ignore */ }
    if (state.isDead(p.id)) {
      p.setGameMode(GameMode.Adventure);
    }
  }

  // Tear down every tracked ticking area (prison + any floor areas still registered).
  for (const name of state.trackedTickingAreas) {
    try { dim.runCommand(`tickingarea remove ${name}`); } catch { /* ignore */ }
  }
  state.resetToIdle();
  // activeFloor is cleared via the module-level setter.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("./pressure_plate") as typeof import("./pressure_plate");
  mod.setActiveFloor(null);
}

function whenChunksLoaded(
  pos: { x: number; y: number; z: number },
  done: (ok: boolean) => void,
): void {
  const dim = world.getDimension("overworld");
  let attempts = 0;
  const tick = (): void => {
    attempts++;
    let ready = false;
    try { ready = dim.getBlock(pos) !== undefined; } catch { ready = false; }
    if (ready) { done(true); return; }
    if (attempts >= CHUNK_WAIT_MAX_ATTEMPTS) { done(false); return; }
    system.runTimeout(tick, CHUNK_WAIT_TICKS);
  };
  system.runTimeout(tick, CHUNK_WAIT_TICKS);
}

function findPlayerById(id: string): Player | undefined {
  for (const p of world.getAllPlayers()) {
    if (p.id === id) return p;
  }
  return undefined;
}
```

**Notes:**
- The Node-style `require()` call inside `runVictory` avoids a circular import between `pressure_plate.ts` (which exports `activeFloor` + `setActiveFloor`) and `descent_transition.ts`. Convert to top-level `import` only if the build proves that the circular import resolves cleanly.
- The transition adds and then immediately removes the interim ticking area because `buildAndEnterFloor` re-adds it with exact bounds. The interim area only exists so `whenChunksLoaded` has chunks to poll for.

- [ ] **Step 2: Typecheck**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run build`
Expected: compiles. If the `require("./pressure_plate")` fails under TypeScript strict mode, replace with:

```ts
import { setActiveFloor as _setActiveFloor } from "./pressure_plate";
_setActiveFloor(null);
```

and add a matching `import { setActiveFloor } from "./pressure_plate";` at the top of the file (circular import is fine because `setActiveFloor` is a function, not a constant).

- [ ] **Step 3: Commit**

```bash
git add src/events/descent_transition.ts
git commit -m "feat(events): descent transition with chunk-load gate + victory branch"
```

---

## Task 13: Floor 4 victory branch wiring (already included in Task 12)

Task 12 includes the victory branch inline within `runDescentTransition`. This task exists only to verify the victory path actually reaches the correct code and produces the expected end state.

**Files:**
- No new files. Manual smoke test only.

- [ ] **Step 1: Verify victory logic is reachable**

Read `src/events/descent_transition.ts` and confirm:
1. `if (leavingFloor >= MAX_FLOOR) { runVictory(state); done(); return; }` — gate present
2. `runVictory()` sets every player to Adventure gamemode, plays sounds, shows title, removes ticking areas, calls `state.resetToIdle()` and `setActiveFloor(null)`.

- [ ] **Step 2: Confirm no typecheck errors**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run build`
Expected: compiles.

- [ ] **Step 3: Commit (no code changes — skip if nothing to commit)**

This task is verification-only. Nothing to commit.

---

## Task 14: Rework death.ts — partial → spectator, total → GameOver

**Files:**
- Modify: `src/events/death.ts`

Remove the existing 5-second countdown reset. Replace with: on death → spectator + markDead. On total death → `triggerGameOver()` + game-over title/message.

- [ ] **Step 1: Replace `src/events/death.ts`**

```ts
import { world, GameMode, Player, system } from "@minecraft/server";
import { RunPhase, type RunState } from "../state/run";
import { commitState } from "../main";
import { activeFloor } from "./pressure_plate";
import { prisonSpec } from "./first_join";

export function registerDeathHandlers(state: RunState): void {
  world.afterEvents.entityDie.subscribe((ev) => {
    const entity = ev.deadEntity;
    if (!(entity instanceof Player)) return;
    if (state.phase !== RunPhase.FloorActive && state.phase !== RunPhase.Prison) return;

    console.warn(`[TrickyMaze] Player died: ${entity.name}`);
    state.markDead(entity.id);
    commitState();

    // Set spectator after the death screen clears.
    system.runTimeout(() => {
      try {
        entity.setGameMode(GameMode.Spectator);
        teleportDeadPlayerToOverview(entity);
      } catch (e) {
        console.warn(`[TrickyMaze] Failed to set spectator: ${String(e)}`);
      }
    }, 10);

    if (state.aliveCount() === 0) {
      triggerGameOver(state);
    }
  });

  world.afterEvents.playerLeave?.subscribe((ev) => {
    if (state.phase !== RunPhase.FloorActive && state.phase !== RunPhase.Prison) return;
    state.markDead(ev.playerId);
    commitState();
    if (state.aliveCount() === 0) {
      triggerGameOver(state);
    }
  });

  world.afterEvents.playerSpawn.subscribe((ev) => {
    // Rehydrate spectator state on respawn (Bedrock resets gamemode across reloads).
    const p = ev.player;
    if (state.phase !== RunPhase.FloorActive && state.phase !== RunPhase.Prison) return;
    if (!state.isDead(p.id)) return;
    system.runTimeout(() => {
      try {
        p.setGameMode(GameMode.Spectator);
        teleportDeadPlayerToOverview(p);
      } catch { /* ignore */ }
    }, 5);
  });
}

function teleportDeadPlayerToOverview(p: Player): void {
  const dim = world.getDimension("overworld");
  if (activeFloor) {
    const a = activeFloor.anchor;
    // Hover roughly over the maze center, a few blocks above the ceiling.
    const center = {
      x: a.x + activeFloor.size * 1.5,
      y: a.y + 15,
      z: a.z + activeFloor.size * 1.5,
    };
    p.teleport(center, { dimension: dim });
    return;
  }
  if (prisonSpec) {
    p.teleport(
      { x: prisonSpec.spawnPos.x, y: prisonSpec.spawnPos.y + 5, z: prisonSpec.spawnPos.z },
      { dimension: dim },
    );
  }
}

function triggerGameOver(state: RunState): void {
  console.warn(`[TrickyMaze] All players dead — GameOver at floor ${state.currentFloor}`);
  state.triggerGameOver();
  commitState();
  for (const p of world.getAllPlayers()) {
    p.onScreenDisplay.setTitle("§4Run Failed", {
      subtitle: `§7Floor ${state.currentFloor} • All heroes fell`,
      fadeInDuration: 10,
      stayDuration: 120,
      fadeOutDuration: 10,
    });
  }
  world.sendMessage("§7Use /scriptevent trickymaze:restart to begin a new run.");
}
```

- [ ] **Step 2: Typecheck**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add src/events/death.ts
git commit -m "feat(events): spectator on death, GameOver on total death"
```

---

## Task 15: Restart scriptevent handler

**Files:**
- Modify: `src/main.ts` (extend existing `scriptEventReceive` subscription)

- [ ] **Step 1: Update `src/main.ts` — extend the scriptevent subscriber**

Find the existing block:

```ts
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id === "trickymaze:shutdown") {
    world.getDimension("overworld").runCommand("gamerule domobspawning true");
    world.sendMessage("§7TrickyMaze shutdown: mob spawning restored.");
    console.warn("[TrickyMaze] Shutdown event received; gamerule restored.");
  }
});
```

Replace with:

```ts
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id === "trickymaze:shutdown") {
    world.getDimension("overworld").runCommand("gamerule domobspawning true");
    world.sendMessage("§7TrickyMaze shutdown: mob spawning restored.");
    console.warn("[TrickyMaze] Shutdown event received; gamerule restored.");
    return;
  }
  if (ev.id === "trickymaze:restart") {
    if (runState.phase !== RunPhase.GameOver) {
      console.warn(`[TrickyMaze] restart ignored — phase is ${runState.phase}`);
      world.sendMessage("§cRestart can only be used after a Run Failed screen.");
      return;
    }
    handleRestart();
  }
});
```

At the bottom of the file (outside the `system.run` block), add:

```ts
function handleRestart(): void {
  console.warn("[TrickyMaze] Restart scriptevent — resetting run.");
  const dim = world.getDimension("overworld");
  for (const name of runState.trackedTickingAreas) {
    try { dim.runCommand(`tickingarea remove ${name}`); } catch { /* ignore */ }
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pp = require("./events/pressure_plate") as typeof import("./events/pressure_plate");
  pp.setActiveFloor(null);
  runState.resetToIdle();
  commitState();
  world.sendMessage("§aRun reset. Respawn or relog to begin a new run.");
}
```

**Import additions at top of `main.ts`:**

```ts
import { RunPhase } from "./state/persistence";
```

(If `RunPhase` is not already imported, add this line.)

- [ ] **Step 2: Typecheck**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(main): restart scriptevent handler"
```

---

## Task 16: Idle-respawn rebuild hook

**Files:**
- Modify: `src/main.ts`

The existing `playerSpawn` handler in `main.ts` only calls `handleFirstJoin` on `initialSpawn === true`. After a restart or victory, a player's respawn/dimension-change/relog should also rebuild the prison.

- [ ] **Step 1: Modify the `playerSpawn` block in `main.ts`**

Find:

```ts
world.afterEvents.playerSpawn.subscribe((ev) => {
  const phase = runState.phase;
  if (phase === RunPhase.Idle) {
    if (ev.initialSpawn) handleFirstJoin(runState);
    return;
  }
  ...
```

Replace with:

```ts
world.afterEvents.playerSpawn.subscribe((ev) => {
  const phase = runState.phase;
  if (phase === RunPhase.Idle) {
    // Rebuild prison on any spawn in Idle — covers first-ever join, post-restart, and post-victory.
    // handleFirstJoin is idempotent if prisonSpec is already set (it early-returns
    // when phase is not Idle after entering Prison).
    handleFirstJoin(runState);
    return;
  }
  if (phase === RunPhase.GameOver) {
    // Dead screen visible — don't rebuild, don't restore. Wait for restart scriptevent.
    return;
  }
  if (phase === RunPhase.Prison || phase === RunPhase.FloorActive) {
    if (!runState.isAlive(ev.player.id) && !runState.isDead(ev.player.id)) {
      runState.markAlive(ev.player.id);
      commitState();
    }
    if (!ev.initialSpawn) return;
    console.warn(`[TrickyMaze] Mid-run join by ${ev.player.name} — tolerated, not teleported.`);
  }
});
```

`handleFirstJoin` already guards with `if (state.phase !== RunPhase.Idle) return;` so repeated calls (e.g., two players respawn at once) are safe — after the first call, phase flips to `Prison` and the second call is a no-op.

- [ ] **Step 2: Typecheck + full test run**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run build && npm test`
Expected: compiles and all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(main): Idle-respawn rebuilds prison after restart/victory"
```

---

## Task 17: Wire exit-plate poll into main.ts

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Import and register the exit-plate poll**

At the top of `src/main.ts`, add:

```ts
import { registerExitPlatePoll } from "./events/exit_plate";
```

Inside the `system.run(() => { ... })` block, after `registerDeathHandlers(runState);`, add:

```ts
registerExitPlatePoll(runState);
```

- [ ] **Step 2: Typecheck**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run build`
Expected: compiles.

- [ ] **Step 3: Run the full test suite**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat(main): register exit-plate poll on init"
```

---

## Task 18: Self-test sanity (content log smoke)

**Files:**
- Modify: `src/main.ts` (add a module-load banner)

- [ ] **Step 1: Update the init banner**

Find:

```ts
console.warn(`[TrickyMaze] Initialized. phase=${runState.phase} floor=${runState.floor}`);
```

Replace with:

```ts
console.warn(
  `[TrickyMaze v1.1] Initialized. phase=${runState.phase} floor=${runState.floor} ` +
    `currentFloor=${runState.currentFloor} tickingAreas=[${runState.trackedTickingAreas.join(",")}]`,
);
```

- [ ] **Step 2: Typecheck**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "chore(main): richer init banner for Plan 2 debug"
```

---

## Task 19: Bump pack manifest versions to 1.1.0

**Files:**
- Modify: `behavior_pack/manifest.json`
- Modify: `resource_pack/manifest.json`
- Modify: `package.json`

- [ ] **Step 1: Read both manifests and update the `version` fields**

Find each manifest's header:

```json
"header": {
  ...
  "version": [1, 0, 0]
}
```

Change to:

```json
"header": {
  ...
  "version": [1, 1, 0]
}
```

Also update each module's version:

```json
"modules": [
  {
    ...
    "version": [1, 0, 0]
  }
]
```

to `[1, 1, 0]`.

- [ ] **Step 2: Update `package.json` version**

```json
"version": "1.1.0"
```

- [ ] **Step 3: Rebuild + package + run tests**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run build && npm test && npm run package`
Expected: build + tests pass, `dist/TrickyMaze.mcaddon` produced with updated version.

- [ ] **Step 4: Commit**

```bash
git add behavior_pack/manifest.json resource_pack/manifest.json package.json
git commit -m "chore(pack): bump version to 1.1.0 for Plan 2"
```

---

## Task 20: End-to-end smoke build + local deploy

**Files:**
- None (build/deploy verification only)

- [ ] **Step 1: Full build**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run build`
Expected: `behavior_pack/scripts/` contains the compiled output from Tasks 3–17 (themes.js, fixtures.js, exit_plate.js, descent.js, descent_transition.js, key_inventory.js, key_item.js, chest_placement.js).

- [ ] **Step 2: Full test**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm test`
Expected: 20+ tests pass across maze/run/fixtures/themes/chest_placement/key_item/sanity.

- [ ] **Step 3: Package**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run package`
Expected: `dist/TrickyMaze.mcaddon`, `dist/TrickyMazeBP.mcpack`, `dist/TrickyMazeRP.mcpack` all present.

- [ ] **Step 4: Local deploy**

Run: `cd C:/code/mc/maze/.worktrees/plan-2 && npm run local-deploy`
Expected: packs deployed to `%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang\development_*_packs\trickymaze\`.

- [ ] **Step 5: In-game smoke (user action, then report)**

Open Minecraft Bedrock, create a new Creator world, enable the `trickymaze` behavior + resource packs, start the world. Verify the Content Log GUI shows:

```
[TrickyMaze v1.1] Initialized. phase=IDLE floor=0 currentFloor=0 tickingAreas=[]
[TrickyMaze] First join detected — building prison.
```

No errors. Step on the prison plate → floor 1 builds with Old Prison palette + a chest + a pressure plate. Pick up the key, stand on the exit plate → descent cinematic fires.

If anything fails, diagnose in the content log and fix before proceeding.

- [ ] **Step 6: Commit** (if any fixes were required during smoke; otherwise skip)

---

## Task 21: Plan 2 QA checklist document

**Files:**
- Create: `docs/superpowers/plans/2026-04-19-trickymaze-plan-2-qa.md`

- [ ] **Step 1: Create the QA document**

```markdown
# Plan 2 QA Checklist

All scenarios performed in a fresh Creator world with `trickymaze` BP + RP enabled. Content Log GUI must be open.

## Scenario 1 — First floor with Old Prison theme

- [ ] Join world → prison builds automatically
- [ ] Step on prison plate → floor 1 builds below
- [ ] Walls are `stone_bricks`, floor is `cobblestone`, ceiling is `stone_bricks`
- [ ] A chest is visible somewhere in the maze
- [ ] An iron door + pressure plate are visible at the exit cell

## Scenario 2 — No-key plate attempt

- [ ] Stand on the exit pressure plate without having opened the chest
- [ ] Chat shows `§cYou need the floor key.`
- [ ] Standing still on the plate only triggers the message once per second (not once per tick)
- [ ] The iron door does NOT open

## Scenario 3 — With-key plate trigger

- [ ] Open the chest → retrieve a renamed tripwire hook named `Floor Key`
- [ ] Stand on the exit plate
- [ ] The key stack count decrements by 1 (or disappears if it was the only one)
- [ ] The iron door opens (redstone block appears below)
- [ ] Descent cinematic fires: title "Descending…", subtitle "Floor 2", cave sound, wither rumble, thunder weather

## Scenario 4 — Descent lands on floor 2

- [ ] After cinematic ends (4 seconds), players arrive on floor 2
- [ ] Floor 2 is 30 blocks below floor 1 (check y-coordinate)
- [ ] Theme is still Old Prison (floors 1-2)
- [ ] A new chest + key + exit plate are visible on floor 2

## Scenario 5 — Theme switch at floor 3

- [ ] Complete floor 2 → descent to floor 3
- [ ] Walls are `deepslate_bricks`, floor is `blackstone`, ceiling is `deepslate_tiles`
- [ ] Chest + key + exit plate still work the same way

## Scenario 6 — Floor 4 victory

- [ ] Complete floor 4's exit plate with key
- [ ] Descent cinematic fires
- [ ] After cinematic ends, "Run Complete!" title + level-up sound + challenge-complete sound
- [ ] Phase returns to Idle — next player respawn rebuilds the prison
- [ ] No floor 5 is generated

## Scenario 7 — Solo death → spectator

- [ ] On floor 2, intentionally die (e.g., jump into void or use `/kill`)
- [ ] Death screen clears → you are in spectator mode hovering above the maze
- [ ] You can fly through walls and observe the maze
- [ ] The Content Log shows `[TrickyMaze] Player died: <name>`

## Scenario 8 — Co-op partial death + recovery

- [ ] Two-player session (or simulate via second account/device)
- [ ] Player A dies on floor 3 → goes to spectator
- [ ] Player B finds the key and activates the exit plate
- [ ] During descent, Player A is teleported to floor 4 start in survival
- [ ] Player A's gamemode is restored to Adventure + can play floor 4

## Scenario 9 — Total death → GameOver + Restart

- [ ] Solo or co-op, all players die
- [ ] Title shows "Run Failed" + "Floor N • All heroes fell"
- [ ] Chat shows "Use /scriptevent trickymaze:restart to begin a new run."
- [ ] Run `/scriptevent trickymaze:restart`
- [ ] Chat shows "Run reset. Respawn or relog to begin a new run."
- [ ] Respawn or relog → prison rebuilds

## Scenario 10 — World reload mid-floor

- [ ] Start a run, reach floor 3, pick up the key
- [ ] Leave the world and re-enter
- [ ] Content Log shows `[TrickyMaze v1.1] Initialized. phase=FLOOR_ACTIVE floor=3 currentFloor=3 tickingAreas=[tm_prison,tm_floor_3]`
- [ ] Maze is still intact
- [ ] Key is still in your inventory
- [ ] Exit plate still works
- [ ] If reload happened mid-descent, Content Log shows "Reload mid-descent — phase reset to FloorActive" and player must re-step the exit plate to descend
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-04-19-trickymaze-plan-2-qa.md
git commit -m "docs: plan 2 QA checklist"
```

---

## Final Verification

- [ ] **All tests pass**: `npm test`
- [ ] **Build succeeds**: `npm run build`
- [ ] **Package succeeds**: `npm run package`
- [ ] **Deploy succeeds**: `npm run local-deploy`
- [ ] **All 10 QA scenarios pass in-game** (see Task 21)
- [ ] **No content-log errors** on init or during any run

Once all boxes are checked, use `superpowers:finishing-a-development-branch` to decide how to ship (merge, PR, etc.).
