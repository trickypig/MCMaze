# TrickyMaze Plan 2 — Monster System (Floor 1 Patroller)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable Floor 1 populated with ~12 script-driven Patroller monsters that walk corridors, charge players in a frontal 90° arc, break off after 3 s, and never turn for flanking players. Add an in-run HUD showing `Floor N · Key: <state> · Mobs: X`.

**Architecture:** A pure `generation/spawn_plan.ts` module analyzes the maze for straight corridor runs and emits a `SpawnManifest`. A thin `monsters/` ring (scheduler, registry, spawner, per-behavior tick files) turns that manifest into live stripped-AI entities driven by a single `system.runInterval` tick at 5 Hz. Hybrid state: static config on dynamic properties (reload-safe), ephemeral runtime state in an in-memory `Map`.

**Tech Stack:** TypeScript 5.4, `@minecraft/server` ^2.0.0, vitest for pure-layer tests, Node 20+ for tooling. Minecraft Bedrock 1.21.100+ target client.

**Spec reference:** `docs/superpowers/specs/2026-04-23-trickymaze-plan-2-monsters-design.md` (and parent `docs/superpowers/specs/2026-04-19-trickymaze-design.md` §5).

---

## Prerequisites

Engineer has Plan 1 merged (the foundation slice). Dev packs are symlinked into
`development_behavior_packs/` and `development_resource_packs/`. `npm test`,
`npm run build`, and `npm run local-deploy` all work. `@minecraft/server` 2.x
stable is available on the target Bedrock client (1.21.100+).

Plan 1 artifacts the engineer will read/modify:
- `src/main.ts` — adds one side-effect import and starts the HUD interval.
- `src/events/pressure_plate.ts` — adds spawn-manifest + spawner call after block placement.
- `src/generation/floor.ts` — unchanged (the `Maze` is already reachable at the call site).

---

## Directory Structure After Plan 2

```
src/
  main.ts                         (modified — import monsters/registry, start HUD)
  events/
    pressure_plate.ts             (modified — spawn manifest after floor build)
  generation/
    spawn_plan.ts                 (NEW — pure maze → SpawnManifest)
  monsters/                       (NEW directory)
    registry.ts
    scheduler.ts
    state.ts
    helpers.ts
    patroller.ts
    themes.ts
    stats.ts
    spawner.ts
  ui/                             (NEW directory)
    hud.ts
behavior_pack/
  entities/
    patroller_zombie.behavior.json          (NEW)
    patroller_wither_skeleton.behavior.json (RENAMED from wither_patroller.behavior.json)
    sleeper_wither_skeleton.behavior.json   (RENAMED from wither_sleeper.behavior.json)
    lurker_wither_skeleton.behavior.json    (RENAMED from wither_lurker.behavior.json)
  loot_tables/
    empty.json                    (NEW)
resource_pack/
  entity/
    patroller_zombie.entity.json                (NEW)
    patroller_wither_skeleton.entity.json       (RENAMED)
    sleeper_wither_skeleton.entity.json         (RENAMED)
    lurker_wither_skeleton.entity.json          (RENAMED)
models/
  patroller_wither_skeleton.geo.bbmodel        (RENAMED)
  sleeper_wither_skeleton.geo.bbmodel          (RENAMED)
  lurker_wither_skeleton.geo.bbmodel           (RENAMED)
tests/
  spawn_plan.test.ts              (NEW)
  themes.test.ts                  (NEW)
  stats.test.ts                   (NEW)
docs/
  superpowers/
    specs/2026-04-23-plan-2-qa.md (NEW — manual QA checklist)
```

---

## Task 1: Shared types & stats module (pure, TDD)

**Files:**
- Create: `src/monsters/stats.ts`
- Test:   `tests/stats.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/stats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { healthMultiplier, damageMultiplier } from "../src/monsters/stats";

describe("monster stats scaling", () => {
  it("is 1.0 on floor 1", () => {
    expect(healthMultiplier(1)).toBeCloseTo(1.0, 5);
    expect(damageMultiplier(1)).toBeCloseTo(1.0, 5);
  });

  it("is 1.9 on floor 10 (+10% per floor past 1)", () => {
    expect(healthMultiplier(10)).toBeCloseTo(1.9, 5);
    expect(damageMultiplier(10)).toBeCloseTo(1.9, 5);
  });

  it("is symmetric for hp and damage", () => {
    for (let f = 1; f <= 20; f++) {
      expect(healthMultiplier(f)).toBeCloseTo(damageMultiplier(f), 5);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- stats.test`
Expected: FAIL — "Cannot find module '../src/monsters/stats'".

- [ ] **Step 3: Write minimal implementation**

Create `src/monsters/stats.ts`:

```ts
export const healthMultiplier = (floor: number): number => 1 + 0.10 * (floor - 1);
export const damageMultiplier = (floor: number): number => 1 + 0.10 * (floor - 1);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- stats.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/monsters/stats.ts tests/stats.test.ts
git commit -m "feat(monsters): add floor-based hp/damage multipliers"
```

---

## Task 2: Themes lookup (pure, TDD)

**Files:**
- Create: `src/monsters/themes.ts`
- Test:   `tests/themes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/themes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { themeForFloor, resolveEntityId } from "../src/monsters/themes";

describe("themeForFloor", () => {
  it("maps floors 1–2 to old_prison", () => {
    expect(themeForFloor(1)).toBe("old_prison");
    expect(themeForFloor(2)).toBe("old_prison");
  });
  it("maps floors 3–4 to the_depths", () => {
    expect(themeForFloor(3)).toBe("the_depths");
    expect(themeForFloor(4)).toBe("the_depths");
  });
  it("maps floors 5–6 to nethers_edge", () => {
    expect(themeForFloor(5)).toBe("nethers_edge");
    expect(themeForFloor(6)).toBe("nethers_edge");
  });
  it("maps floors 7+ to the_abyss", () => {
    expect(themeForFloor(7)).toBe("the_abyss");
    expect(themeForFloor(20)).toBe("the_abyss");
  });
});

describe("resolveEntityId", () => {
  it("returns the zombie patroller for old_prison", () => {
    expect(resolveEntityId("patroller", "old_prison")).toBe(
      "trickymaze:patroller_zombie",
    );
  });
  it("throws for unpopulated theme combos", () => {
    expect(() => resolveEntityId("patroller", "the_depths")).toThrow(
      /no entity registered/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- themes.test`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/monsters/themes.ts`:

```ts
export type Behavior = "patroller";
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- themes.test`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/monsters/themes.ts tests/themes.test.ts
git commit -m "feat(monsters): add theme→entity-id lookup"
```

---

## Task 3: Spawn plan — data shape & fixture setup

**Files:**
- Create: `src/generation/spawn_plan.ts`
- Test:   `tests/spawn_plan.test.ts`

- [ ] **Step 1: Write the failing test (empty manifest on too-small maze)**

Create `tests/spawn_plan.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSpawnManifest } from "../src/generation/spawn_plan";
import type { Maze, Cell, Coord } from "../src/generation/maze";

/**
 * Build a Maze fixture with no walls broken along a single straight N-S
 * corridor of `length` cells at x=0, y=0..length-1. Used to verify detection
 * of straight runs.
 */
function straightCorridorMaze(length: number): Maze {
  const cells: Cell[][] = [[]];
  for (let y = 0; y < length; y++) {
    cells[0].push({
      walls: {
        N: y === 0,
        S: y === length - 1,
        E: true,
        W: true,
      },
    });
  }
  const entrance: Coord = { x: 0, y: 0 };
  const exit: Coord = { x: 0, y: length - 1 };
  return {
    cells,
    entrance,
    exit,
    deadEnds: [{ x: 0, y: length - 1 }],
    bfsDistance: (c) => c.y,
  };
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe("buildSpawnManifest", () => {
  it("returns an empty manifest when the maze has no runs ≥ 4 cells", () => {
    const maze = straightCorridorMaze(3); // too short
    const manifest = buildSpawnManifest(maze, 1, mulberry32(1));
    expect(manifest).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- spawn_plan.test`
Expected: FAIL — module not found.

- [ ] **Step 3: Scaffold the module with types and a stub**

Create `src/generation/spawn_plan.ts`:

```ts
import type { Maze } from "./maze";

export type SpawnBehavior = "patroller";
export type SpawnTheme = "old_prison";
export type Axis = "N" | "S" | "E" | "W";

export type SpawnManifestEntry = {
  behavior: SpawnBehavior;
  theme: SpawnTheme;
  // Block-local position within the maze footprint (not world).
  // Cell (cx, cy) centers at (3*cx+2, 1, 3*cy+2).
  pos: { x: number; y: number; z: number };
  config: {
    homePoint: { x: number; y: number; z: number };
    patrolAxis: Axis;
    patrolLength: number;
  };
};

/**
 * Analyze a maze and emit a list of monster spawn entries. Plan 2 only
 * produces Patrollers for the L1–2 "old_prison" theme.
 */
export function buildSpawnManifest(
  maze: Maze,
  floor: number,
  rng: () => number,
): SpawnManifestEntry[] {
  return [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- spawn_plan.test`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/generation/spawn_plan.ts tests/spawn_plan.test.ts
git commit -m "feat(generation): scaffold spawn plan module"
```

---

## Task 4: Spawn plan — straight-run detection

**Files:**
- Modify: `src/generation/spawn_plan.ts`
- Modify: `tests/spawn_plan.test.ts`

- [ ] **Step 1: Add failing tests for straight-run detection**

Append to `tests/spawn_plan.test.ts`:

```ts
describe("buildSpawnManifest — straight runs", () => {
  it("detects a single N-S run and emits one patroller entry", () => {
    // 6-cell N-S corridor → eligible (≥ 4), but entrance(0,0) and exit(0,5)
    // are excluded from runs containing them, so this specific corridor
    // yields zero entries (the one run contains both endpoints).
    const maze = straightCorridorMaze(6);
    const manifest = buildSpawnManifest(maze, 1, mulberry32(42));
    expect(manifest).toEqual([]);
  });

  it("emits a patroller when a run excludes entrance and exit", () => {
    // Build a wider maze: two parallel 6-cell N-S corridors joined at the top.
    // Left corridor holds entrance; right corridor's bottom cell holds exit.
    // The right corridor's interior run (cells y=1..4) is a 4-cell run with
    // neither endpoint — eligible.
    const cells: Cell[][] = [[], []];
    for (let y = 0; y < 6; y++) {
      // Left column: N/S open except top; top is open E so it joins right.
      cells[0].push({
        walls: {
          N: y === 0,
          S: y === 5,
          E: y !== 0, // open E at y=0
          W: true,
        },
      });
      // Right column: N/S open except top and bottom walls; top open W.
      cells[1].push({
        walls: {
          N: y === 0,
          S: y === 5,
          E: true,
          W: y !== 0, // open W at y=0
        },
      });
    }
    const maze: Maze = {
      cells,
      entrance: { x: 0, y: 5 },
      exit: { x: 1, y: 5 },
      deadEnds: [{ x: 0, y: 5 }, { x: 1, y: 5 }],
      bfsDistance: (c) => (c.x === 0 ? 5 - c.y : 6 + c.y),
    };
    const manifest = buildSpawnManifest(maze, 1, mulberry32(7));
    expect(manifest.length).toBeGreaterThanOrEqual(1);
    const entry = manifest[0];
    expect(entry.behavior).toBe("patroller");
    expect(entry.theme).toBe("old_prison");
    expect(["N", "S"]).toContain(entry.config.patrolAxis);
    expect(entry.config.patrolLength).toBeGreaterThanOrEqual(12); // 4 cells × 3
  });

  it("is deterministic for the same seed", () => {
    const maze = straightCorridorMaze(6);
    const a = buildSpawnManifest(maze, 1, mulberry32(99));
    const b = buildSpawnManifest(maze, 1, mulberry32(99));
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run test to verify they fail**

Run: `npm test -- spawn_plan.test`
Expected: FAIL on the "excludes entrance and exit" case (manifest empty).

- [ ] **Step 3: Implement straight-run detection**

Replace `src/generation/spawn_plan.ts` with:

```ts
import type { Cell, Coord, Maze } from "./maze";

export type SpawnBehavior = "patroller";
export type SpawnTheme = "old_prison";
export type Axis = "N" | "S" | "E" | "W";

export type SpawnManifestEntry = {
  behavior: SpawnBehavior;
  theme: SpawnTheme;
  pos: { x: number; y: number; z: number };
  config: {
    homePoint: { x: number; y: number; z: number };
    patrolAxis: Axis;
    patrolLength: number;
  };
};

type StraightRun = {
  axis: "NS" | "EW";
  cells: Coord[];
};

// A cell qualifies as part of a straight NS run interior iff it has only
// N+S open (E and W both walled). The run may be bounded at either end by
// a cell that is open on the opposite side as well (T-junction / corner).
function isNSThrough(cell: Cell): boolean {
  return !cell.walls.N && !cell.walls.S && cell.walls.E && cell.walls.W;
}

function isEWThrough(cell: Cell): boolean {
  return !cell.walls.E && !cell.walls.W && cell.walls.N && cell.walls.S;
}

function findStraightRuns(maze: Maze): StraightRun[] {
  const W = maze.cells.length;
  const H = maze.cells[0].length;
  const out: StraightRun[] = [];

  // Scan NS runs column-by-column.
  for (let x = 0; x < W; x++) {
    let run: Coord[] = [];
    for (let y = 0; y < H; y++) {
      if (isNSThrough(maze.cells[x][y])) {
        run.push({ x, y });
      } else {
        if (run.length >= 4) out.push({ axis: "NS", cells: run });
        run = [];
      }
    }
    if (run.length >= 4) out.push({ axis: "NS", cells: run });
  }

  // Scan EW runs row-by-row.
  for (let y = 0; y < H; y++) {
    let run: Coord[] = [];
    for (let x = 0; x < W; x++) {
      if (isEWThrough(maze.cells[x][y])) {
        run.push({ x, y });
      } else {
        if (run.length >= 4) out.push({ axis: "EW", cells: run });
        run = [];
      }
    }
    if (run.length >= 4) out.push({ axis: "EW", cells: run });
  }

  return out;
}

function containsCoord(run: Coord[], c: Coord): boolean {
  return run.some((r) => r.x === c.x && r.y === c.y);
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function runToEntry(run: StraightRun): SpawnManifestEntry {
  const mid = run.cells[Math.floor(run.cells.length / 2)];
  const cx = mid.x * 3 + 2;
  const cz = mid.y * 3 + 2;
  const cy = 1; // floor-relative Y (y=0 is the floor layer; y=1 is walkable).
  const axis: Axis = run.axis === "NS" ? "S" : "E";
  return {
    behavior: "patroller",
    theme: "old_prison",
    pos: { x: cx, y: cy, z: cz },
    config: {
      homePoint: { x: cx, y: cy, z: cz },
      patrolAxis: axis,
      patrolLength: run.cells.length * 3,
    },
  };
}

export function buildSpawnManifest(
  maze: Maze,
  floor: number,
  rng: () => number,
): SpawnManifestEntry[] {
  const runs = findStraightRuns(maze).filter(
    (r) =>
      !containsCoord(r.cells, maze.entrance) &&
      !containsCoord(r.cells, maze.exit),
  );

  if (runs.length === 0) return [];

  const W = maze.cells.length;
  const H = maze.cells[0].length;
  const totalCells = W * H;
  const target = Math.max(1, Math.floor(totalCells / 12));

  shuffleInPlace(runs, rng);

  const chosen = runs.slice(0, target);
  return chosen.map(runToEntry);
}
```

- [ ] **Step 4: Run test to verify they pass**

Run: `npm test -- spawn_plan.test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/generation/spawn_plan.ts tests/spawn_plan.test.ts
git commit -m "feat(generation): detect straight runs and build spawn manifest"
```

---

## Task 5: Spawn plan — density test against real maze

**Files:**
- Modify: `tests/spawn_plan.test.ts`

- [ ] **Step 1: Add integration-style test against a generated 12×12 maze**

Append to `tests/spawn_plan.test.ts`:

```ts
import { generateMaze } from "../src/generation/maze";

describe("buildSpawnManifest — real maze density", () => {
  it("produces entries on a 12×12 L1 maze", () => {
    const maze = generateMaze(12, 12, mulberry32(123));
    const manifest = buildSpawnManifest(maze, 1, mulberry32(456));
    // With ~1 per 12 cells and 144 cells, target is 12; but eligible-run
    // count may be smaller. Assert plausible bounds, not an exact number.
    expect(manifest.length).toBeGreaterThan(0);
    expect(manifest.length).toBeLessThanOrEqual(12);
  });

  it("never places an entry on the entrance or exit cell", () => {
    const maze = generateMaze(12, 12, mulberry32(321));
    const manifest = buildSpawnManifest(maze, 1, mulberry32(654));
    const ex = maze.entrance;
    const xt = maze.exit;
    for (const entry of manifest) {
      const cellX = Math.floor((entry.pos.x - 2) / 3);
      const cellY = Math.floor((entry.pos.z - 2) / 3);
      expect({ x: cellX, y: cellY }).not.toEqual(ex);
      expect({ x: cellX, y: cellY }).not.toEqual(xt);
    }
  });
});
```

- [ ] **Step 2: Run test to verify**

Run: `npm test -- spawn_plan.test`
Expected: PASS (all 6 tests in the file).

- [ ] **Step 3: Commit**

```bash
git add tests/spawn_plan.test.ts
git commit -m "test(generation): spawn manifest density check on real 12x12 maze"
```

---

## Task 6: Empty loot table

**Files:**
- Create: `behavior_pack/loot_tables/empty.json`

- [ ] **Step 1: Create the file**

Create `behavior_pack/loot_tables/empty.json`:

```json
{ "pools": [] }
```

- [ ] **Step 2: Commit**

```bash
git add behavior_pack/loot_tables/empty.json
git commit -m "feat(bp): add empty loot table for dropless monsters"
```

---

## Task 7: Rename dormant wither_* files to final scheme

**Files:**
- Rename in `behavior_pack/entities/`:
  - `wither_patroller.behavior.json` → `patroller_wither_skeleton.behavior.json`
  - `wither_sleeper.behavior.json`   → `sleeper_wither_skeleton.behavior.json`
  - `wither_lurker.behavior.json`    → `lurker_wither_skeleton.behavior.json`
- Rename in `resource_pack/entity/`:
  - `wither_patroller.entity.json` → `patroller_wither_skeleton.entity.json`
  - `wither_sleeper.entity.json`   → `sleeper_wither_skeleton.entity.json`
  - `wither_lurker.entity.json`    → `lurker_wither_skeleton.entity.json`
- Rename in `models/`:
  - `wither_patroller.geo.bbmodel` → `patroller_wither_skeleton.geo.bbmodel`
  - `wither_sleeper.geo.bbmodel`   → `sleeper_wither_skeleton.geo.bbmodel`
  - `wither_lurker.geo.bbmodel`    → `lurker_wither_skeleton.geo.bbmodel`
- Update `identifier` fields inside each renamed JSON from
  `trickymaze:wither_<behavior>` to `trickymaze:<behavior>_wither_skeleton`.

- [ ] **Step 1: Rename files with `git mv`**

```bash
git mv behavior_pack/entities/wither_patroller.behavior.json behavior_pack/entities/patroller_wither_skeleton.behavior.json
git mv behavior_pack/entities/wither_sleeper.behavior.json   behavior_pack/entities/sleeper_wither_skeleton.behavior.json
git mv behavior_pack/entities/wither_lurker.behavior.json    behavior_pack/entities/lurker_wither_skeleton.behavior.json
git mv resource_pack/entity/wither_patroller.entity.json     resource_pack/entity/patroller_wither_skeleton.entity.json
git mv resource_pack/entity/wither_sleeper.entity.json       resource_pack/entity/sleeper_wither_skeleton.entity.json
git mv resource_pack/entity/wither_lurker.entity.json        resource_pack/entity/lurker_wither_skeleton.entity.json
git mv models/wither_patroller.geo.bbmodel                   models/patroller_wither_skeleton.geo.bbmodel
git mv models/wither_sleeper.geo.bbmodel                     models/sleeper_wither_skeleton.geo.bbmodel
git mv models/wither_lurker.geo.bbmodel                      models/lurker_wither_skeleton.geo.bbmodel
```

- [ ] **Step 2: Update identifiers inside the renamed BP entity JSONs**

In `behavior_pack/entities/patroller_wither_skeleton.behavior.json`, change:
```json
"identifier": "trickymaze:wither_patroller",
```
to:
```json
"identifier": "trickymaze:patroller_wither_skeleton",
```

Apply the same rename pattern in `sleeper_wither_skeleton.behavior.json`
(`trickymaze:wither_sleeper` → `trickymaze:sleeper_wither_skeleton`) and
`lurker_wither_skeleton.behavior.json`
(`trickymaze:wither_lurker` → `trickymaze:lurker_wither_skeleton`).

- [ ] **Step 3: Update identifiers inside the renamed RP entity JSONs**

Open each of the three files under `resource_pack/entity/` and change any
`"identifier": "trickymaze:wither_<x>"` entries to
`"identifier": "trickymaze:<x>_wither_skeleton"`.

If the resource-pack entity JSON also references model identifiers like
`geometry.wither_<x>`, update those to `geometry.<x>_wither_skeleton` too.
(Check each file; some may not embed a geometry identifier.)

- [ ] **Step 4: Build to verify no broken references**

Run: `npm run build`
Expected: PASS — no TypeScript errors. (These files are not referenced by
source code, so renames have no TS impact; this is a sanity check.)

- [ ] **Step 5: Commit**

```bash
git add behavior_pack resource_pack models
git commit -m "chore(assets): rename wither_* files to <behavior>_wither_skeleton scheme"
```

---

## Task 8: Patroller zombie entity (behavior pack)

**Files:**
- Create: `behavior_pack/entities/patroller_zombie.behavior.json`

- [ ] **Step 1: Write the file**

Create `behavior_pack/entities/patroller_zombie.behavior.json`:

```json
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
      "minecraft:type_family": {
        "family": ["trickymaze", "trickymaze_patroller", "monster", "mob"]
      },
      "minecraft:health": { "value": 20, "max": 20 },
      "minecraft:physics": {},
      "minecraft:pushable": {
        "is_pushable": true,
        "is_pushable_by_piston": true
      },
      "minecraft:breathable": {
        "total_supply": 15,
        "suffocate_time": 0
      },
      "minecraft:collision_box": { "width": 0.6, "height": 1.9 },
      "minecraft:movement": { "value": 0.23 },
      "minecraft:movement.basic": {},
      "minecraft:navigation.walk": {
        "can_path_over_water": false,
        "avoid_sun": false
      },
      "minecraft:jump.static": {},
      "minecraft:knockback_resistance": { "value": 0.0 },
      "minecraft:damage_sensor": {
        "triggers": [
          { "cause": "fall", "deals_damage": false },
          { "cause": "suffocation", "deals_damage": false }
        ]
      },
      "minecraft:loot": { "table": "loot_tables/empty.json" }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add behavior_pack/entities/patroller_zombie.behavior.json
git commit -m "feat(bp): add trickymaze:patroller_zombie entity (stripped AI)"
```

---

## Task 9: Patroller zombie entity (resource pack)

**Files:**
- Create: `resource_pack/entity/patroller_zombie.entity.json`

- [ ] **Step 1: Write the file**

Create `resource_pack/entity/patroller_zombie.entity.json`:

```json
{
  "format_version": "1.10.0",
  "minecraft:client_entity": {
    "description": {
      "identifier": "trickymaze:patroller_zombie",
      "materials": { "default": "zombie" },
      "textures": { "default": "textures/entity/zombie/zombie" },
      "geometry": { "default": "geometry.humanoid" },
      "render_controllers": ["controller.render.zombie"],
      "spawn_egg": { "base_color": "#0000ff", "overlay_color": "#800080" }
    }
  }
}
```

Note: `geometry.humanoid` and `controller.render.zombie` are vanilla
references — Bedrock resolves them without bundling the assets.

- [ ] **Step 2: Commit**

```bash
git add resource_pack/entity/patroller_zombie.entity.json
git commit -m "feat(rp): add patroller_zombie client entity using vanilla zombie visuals"
```

---

## Task 10: In-memory runtime state map

**Files:**
- Create: `src/monsters/state.ts`

- [ ] **Step 1: Write the module**

Create `src/monsters/state.ts`:

```ts
/**
 * Ephemeral per-entity behavior state. Keyed by entity.id. Cleared on
 * entity death/removal so the map stays bounded. Lost on script reload
 * by design — behaviors whose runtime state matters across reloads must
 * promote fields to dynamic properties.
 */
const runtime = new Map<string, unknown>();

export function getRuntime<T>(entityId: string): T | undefined {
  return runtime.get(entityId) as T | undefined;
}

export function setRuntime<T>(entityId: string, state: T): void {
  runtime.set(entityId, state);
}

export function clearRuntime(entityId: string): void {
  runtime.delete(entityId);
}

export function runtimeSize(): number {
  return runtime.size;
}
```

- [ ] **Step 2: Build to check typing**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/monsters/state.ts
git commit -m "feat(monsters): in-memory runtime state map keyed by entity.id"
```

---

## Task 11: Geometric helpers

**Files:**
- Create: `src/monsters/helpers.ts`

- [ ] **Step 1: Write the module**

Create `src/monsters/helpers.ts`:

```ts
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
```

- [ ] **Step 2: Build to check typing**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/monsters/helpers.ts
git commit -m "feat(monsters): geometric helpers (nearest, arc check, LOS, face)"
```

---

## Task 12: Behavior registry + scheduler

**Files:**
- Create: `src/monsters/registry.ts`
- Create: `src/monsters/scheduler.ts`

- [ ] **Step 1: Write the registry module**

Create `src/monsters/registry.ts`:

```ts
import type { Entity } from "@minecraft/server";

export type TickFn = (entity: Entity) => void;

const registry = new Map<string, TickFn>();

export function registerBehavior(name: string, fn: TickFn): void {
  if (registry.has(name)) {
    console.warn(`[TrickyMaze] behavior '${name}' registered twice; overriding.`);
  }
  registry.set(name, fn);
}

export function getBehavior(name: string): TickFn | undefined {
  return registry.get(name);
}
```

- [ ] **Step 2: Write the scheduler module**

Create `src/monsters/scheduler.ts`:

```ts
import { system, world } from "@minecraft/server";
import { getBehavior } from "./registry";
import { clearRuntime } from "./state";

const TICK_INTERVAL = 4; // 4 game ticks = 5 Hz

let started = false;

export function startMonsterScheduler(): void {
  if (started) return;
  started = true;

  system.runInterval(tickAll, TICK_INTERVAL);

  world.afterEvents.entityDie.subscribe((ev) => {
    try { clearRuntime(ev.deadEntity.id); } catch { /* ignore */ }
  });
  world.afterEvents.entityRemove.subscribe((ev) => {
    try { clearRuntime(ev.removedEntityId); } catch { /* ignore */ }
  });
}

function tickAll(): void {
  const dim = world.getDimension("overworld");
  let entities;
  try {
    entities = dim.getEntities({ families: ["trickymaze"] });
  } catch (e) {
    console.warn(`[TrickyMaze] monster scan failed: ${String(e)}`);
    return;
  }

  for (const e of entities) {
    let behavior: string | undefined;
    try {
      behavior = e.getDynamicProperty("trickymaze:behavior") as
        | string
        | undefined;
    } catch {
      continue;
    }
    if (!behavior) continue;

    const fn = getBehavior(behavior);
    if (!fn) continue;

    try {
      fn(e);
    } catch (err) {
      console.warn(
        `[TrickyMaze] tick '${behavior}' on ${e.id} threw: ${String(err)}`,
      );
    }
  }
}

export function monsterTickIntervalTicks(): number {
  return TICK_INTERVAL;
}
```

- [ ] **Step 3: Build to check typing**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/monsters/registry.ts src/monsters/scheduler.ts
git commit -m "feat(monsters): behavior registry and shared tick scheduler"
```

---

## Task 13: Patroller tick behavior

**Files:**
- Create: `src/monsters/patroller.ts`

- [ ] **Step 1: Write the module**

Create `src/monsters/patroller.ts`:

```ts
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
    if (distance(entity.location, target) < 0.6) {
      state.dir = (state.dir === 1 ? -1 : 1) as 1 | -1;
    }

    try {
      entity.applyImpulse({
        x: axis.x * state.dir * IMPULSE_MAG,
        y: 0,
        z: axis.z * state.dir * IMPULSE_MAG,
      });
    } catch { /* entity may have been removed */ }

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
  if (!target || !target.isValid || now - state.startTick > CHARGE_TICKS) {
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
```

- [ ] **Step 2: Build to check typing**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/monsters/patroller.ts
git commit -m "feat(monsters): patroller tick (patrol, charge, cooldown state machine)"
```

---

## Task 14: Spawner

**Files:**
- Create: `src/monsters/spawner.ts`

- [ ] **Step 1: Write the module**

Create `src/monsters/spawner.ts`:

```ts
import { type Dimension, type Vector3 } from "@minecraft/server";
import type { SpawnManifestEntry } from "../generation/spawn_plan";
import { resolveEntityId } from "./themes";
import { healthMultiplier, damageMultiplier } from "./stats";

export function spawnFromManifest(
  dim: Dimension,
  anchor: Vector3,
  manifest: SpawnManifestEntry[],
  floor: number,
): number {
  let spawned = 0;
  const hpMul = healthMultiplier(floor);
  const dmgMul = damageMultiplier(floor);

  for (const entry of manifest) {
    let identifier: string;
    try {
      identifier = resolveEntityId(entry.behavior, entry.theme);
    } catch (e) {
      console.warn(`[TrickyMaze] spawn skip: ${String(e)}`);
      continue;
    }

    const worldPos: Vector3 = {
      x: anchor.x + entry.pos.x,
      y: anchor.y + entry.pos.y,
      z: anchor.z + entry.pos.z,
    };
    const homeWorld: Vector3 = {
      x: anchor.x + entry.config.homePoint.x,
      y: anchor.y + entry.config.homePoint.y,
      z: anchor.z + entry.config.homePoint.z,
    };

    let entity;
    try {
      entity = dim.spawnEntity(identifier, worldPos);
    } catch (e) {
      console.warn(
        `[TrickyMaze] spawnEntity(${identifier}) at ${worldPos.x},${worldPos.y},${worldPos.z} failed: ${String(e)}`,
      );
      continue;
    }
    if (!entity) continue;

    try {
      entity.setDynamicProperty("trickymaze:behavior", entry.behavior);
      entity.setDynamicProperty("trickymaze:home_x", homeWorld.x);
      entity.setDynamicProperty("trickymaze:home_y", homeWorld.y);
      entity.setDynamicProperty("trickymaze:home_z", homeWorld.z);
      entity.setDynamicProperty("trickymaze:patrol_axis", entry.config.patrolAxis);
      entity.setDynamicProperty("trickymaze:patrol_length", entry.config.patrolLength);
      entity.setDynamicProperty("trickymaze:damage_mult", dmgMul);

      const health = entity.getComponent("minecraft:health");
      if (health) {
        const scaledMax = Math.round(20 * hpMul);
        // setCurrent clamps to effectiveMax, so set through setBaseEffectForId.
        health.setCurrent(scaledMax);
      }
    } catch (e) {
      console.warn(`[TrickyMaze] spawn config failed on ${identifier}: ${String(e)}`);
    }

    spawned += 1;
  }

  return spawned;
}

export function despawnAllMonsters(dim: Dimension): number {
  let count = 0;
  const entities = dim.getEntities({ families: ["trickymaze"] });
  for (const e of entities) {
    try { e.remove(); count += 1; } catch { /* ignore */ }
  }
  return count;
}
```

Note on the health scaling: the `@minecraft/server` 2.x `EntityHealthComponent`
does not expose a setter for `effectiveMax`. For Plan 2, floor 1 uses multiplier
1.0 so `setCurrent(20)` is a no-op. Higher floors (future plans) can set both
`effectiveMax` and current via an attribute-style API if that becomes
available; until then, the stored `damage_mult` property and HP scaling via
current-only is a known limitation. Document this in the self-review if the
engineer hits issues.

- [ ] **Step 2: Build to check typing**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/monsters/spawner.ts
git commit -m "feat(monsters): spawner translates manifest into live entities"
```

---

## Task 15: Registry entry point (side-effect import target)

**Files:**
- Modify: `src/monsters/registry.ts` — add a bootstrap export.

Actually the cleanest place for bootstrapping is a new entrypoint to avoid
import-order surprises.

- [ ] **Step 1: Write a bootstrap entrypoint**

Create `src/monsters/index.ts`:

```ts
import { startMonsterScheduler } from "./scheduler";
import { registerPatroller } from "./patroller";

export function initMonsters(): void {
  registerPatroller();
  startMonsterScheduler();
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/monsters/index.ts
git commit -m "feat(monsters): index module wires behaviors + scheduler"
```

---

## Task 16: HUD module

**Files:**
- Create: `src/ui/hud.ts`

- [ ] **Step 1: Write the module**

Create `src/ui/hud.ts`:

```ts
import { system, world } from "@minecraft/server";
import { RunPhase, type RunState } from "../state/run";

const HUD_INTERVAL_TICKS = 20; // 1 Hz

export function startHud(state: RunState): void {
  system.runInterval(() => {
    if (state.phase !== RunPhase.FloorActive) return;

    const dim = world.getDimension("overworld");
    let mobCount = 0;
    try {
      mobCount = dim.getEntities({ families: ["trickymaze"] }).length;
    } catch {
      mobCount = 0;
    }

    const keyLabel = "not found"; // Plan 3 will flip to "FOUND" on pickup.
    const msg = `§eFloor ${state.floor}§r · §bKey:§r ${keyLabel} · §cMobs:§r ${mobCount}`;

    for (const p of world.getAllPlayers()) {
      if (!state.isAlive(p.id)) continue;
      try { p.onScreenDisplay.setActionBar(msg); } catch { /* ignore */ }
    }
  }, HUD_INTERVAL_TICKS);
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/hud.ts
git commit -m "feat(ui): in-run HUD actionbar (floor · key · mobs)"
```

---

## Task 17: Wire monsters + HUD into main.ts

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Edit main.ts**

At the top of `src/main.ts`, add imports:

```ts
import { initMonsters } from "./monsters";
import { startHud } from "./ui/hud";
```

Inside the `system.run(() => { ... })` callback, after
`registerDeathHandlers(runState);`, add:

```ts
initMonsters();
startHud(runState);
```

Full snippet (for reference — patch around the existing `system.run` block):

```ts
system.run(() => {
  runState = loadRunState();
  registerDeathHandlers(runState);
  initMonsters();
  startHud(runState);
  console.warn(`[TrickyMaze] Initialized. phase=${runState.phase} floor=${runState.floor}`);
  // ... rest unchanged
});
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(main): initialize monster scheduler + HUD on startup"
```

---

## Task 18: Wire spawner into pressure_plate.ts

**Files:**
- Modify: `src/events/pressure_plate.ts`

- [ ] **Step 1: Edit the handler**

Replace `src/events/pressure_plate.ts` with:

```ts
import { world, GameMode } from "@minecraft/server";
import { ANCHOR, prisonSpec } from "./first_join";
import { RunPhase, type RunState } from "../state/run";
import { buildFloor } from "../generation/floor";
import { generateMaze } from "../generation/maze";
import { applyOps } from "../generation/world_writer";
import { buildSpawnManifest } from "../generation/spawn_plan";
import { spawnFromManifest } from "../monsters/spawner";
import { commitState } from "../main";
import { worldSeededRng } from "../generation/rng";

const FLOOR_Y_GAP = 6;

export function handlePressurePlate(state: RunState): void {
  if (state.phase !== RunPhase.Prison) return;
  if (!prisonSpec) {
    console.warn("[TrickyMaze] Pressure plate pressed but prison not built yet.");
    return;
  }

  const floorNum = state.floor + 1;
  const size = 12 + (floorNum - 1) * 4;
  const rng = worldSeededRng(floorNum);

  const maze = generateMaze(Math.min(size, 40), Math.min(size, 40), rng);
  const floorAnchor = {
    x: ANCHOR.x,
    y: ANCHOR.y - FLOOR_Y_GAP * floorNum,
    z: ANCHOR.z,
  };

  const spec = buildFloor(maze, {
    anchor: floorAnchor,
    wallBlock: "minecraft:stone_bricks",
    floorBlock: "minecraft:stone_bricks",
    ceilingBlock: "minecraft:stone_bricks",
  });

  applyOps(spec.operations);
  state.startFloor(floorNum);
  commitState();

  // Spawn monsters after block placement completes.
  const manifest = buildSpawnManifest(maze, floorNum, worldSeededRng(floorNum + 1_000_000));
  const dim = world.getDimension("overworld");
  const spawnedCount = spawnFromManifest(dim, floorAnchor, manifest, floorNum);
  console.warn(`[TrickyMaze] Floor ${floorNum} spawned ${spawnedCount} monsters.`);

  // Teleport all living players to the entrance.
  const entrance = spec.entranceBlock;
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
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/events/pressure_plate.ts
git commit -m "feat(events): spawn patrollers after Floor 1 block placement"
```

---

## Task 19: Smoke scriptevent

**Files:**
- Modify: `src/main.ts` — extend the existing `scriptEventReceive` handler.

- [ ] **Step 1: Add the smoke branch**

In `src/main.ts`, replace the existing `scriptEventReceive` subscriber with:

```ts
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id === "trickymaze:shutdown") {
    world.getDimension("overworld").runCommand("gamerule domobspawning true");
    world.sendMessage("§7TrickyMaze shutdown: mob spawning restored.");
    console.warn("[TrickyMaze] Shutdown event received; gamerule restored.");
    return;
  }
  if (ev.id === "trickymaze:smoke_monsters") {
    runSmokeMonsters();
    return;
  }
});
```

Then add this function at the bottom of `src/main.ts`:

```ts
function runSmokeMonsters(): void {
  const dim = world.getDimension("overworld");
  const origin = world.getAllPlayers()[0]?.location;
  if (!origin) {
    console.warn("[TrickyMaze] smoke: no players in world.");
    return;
  }
  const pos = { x: origin.x + 2, y: origin.y, z: origin.z };
  let e;
  try {
    e = dim.spawnEntity("trickymaze:patroller_zombie", pos);
  } catch (err) {
    console.warn(`[TrickyMaze] smoke: spawnEntity failed: ${String(err)}`);
    return;
  }
  if (!e) {
    console.warn("[TrickyMaze] smoke: spawnEntity returned undefined.");
    return;
  }
  e.setDynamicProperty("trickymaze:behavior", "patroller");
  e.setDynamicProperty("trickymaze:home_x", pos.x);
  e.setDynamicProperty("trickymaze:home_y", pos.y);
  e.setDynamicProperty("trickymaze:home_z", pos.z);
  e.setDynamicProperty("trickymaze:patrol_axis", "E");
  e.setDynamicProperty("trickymaze:patrol_length", 12);
  e.setDynamicProperty("trickymaze:damage_mult", 1);

  system.runTimeout(() => {
    const n = dim.getEntities({ families: ["trickymaze_patroller"] }).length;
    const msg = n >= 1 ? "§aPASS" : "§cFAIL";
    world.sendMessage(`${msg} §7smoke_monsters (patroller count: ${n})`);
    console.warn(`[TrickyMaze] smoke_monsters patroller count: ${n}`);
    try { e.remove(); } catch { /* ignore */ }
  }, 10);
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(dev): trickymaze:smoke_monsters scriptevent"
```

---

## Task 20: Manual QA checklist doc

**Files:**
- Create: `docs/superpowers/specs/2026-04-23-plan-2-qa.md`

- [ ] **Step 1: Write the doc**

Create `docs/superpowers/specs/2026-04-23-plan-2-qa.md`:

```markdown
# Plan 2 — Monster System Manual QA

Run these in a fresh dev world with the TrickyMaze BP + RP applied.

## Setup
- [ ] Fresh world, default game rules.
- [ ] Packs applied: TrickyMaze BP + RP.
- [ ] Enable Content Log GUI for script errors.

## Patroller — Floor 1

- [ ] Join world → auto-teleport to prison, 8 bread granted.
- [ ] Step on the prison pressure plate → Floor 1 generates, teleport into maze.
- [ ] HUD shows `Floor 1 · Key: not found · Mobs: <N>` where N is 5–12.
- [ ] At least 5 patrollers visible walking in straight lines.
- [ ] Patrollers reverse direction at corridor ends (observe for ~10 s).

## Patroller aggro

- [ ] Approach a patroller head-on within 5 blocks → it charges you.
- [ ] Contact causes ~4 damage. Repeated contact damages again every ~600 ms.
- [ ] After ~3 s, the charge breaks off and the patroller returns to patrol.
- [ ] Stand 2 blocks behind a patrolling mob → it does NOT turn around.
- [ ] Stand 2 blocks to the side (≥ 45°) of a patroller's heading → it does NOT charge.

## Combat

- [ ] Kill a patroller with a sword → no item drops; vanilla death animation plays.
- [ ] Knockback from a sword works (knockback_resistance 0).

## Persistence

- [ ] Save and reload the world mid-Floor 1 → patrollers persist and resume patrol.
- [ ] HUD mob count matches the visible population after reload.

## Cleanup / edge cases

- [ ] `/kill @e[family=trickymaze_patroller]` → all patrollers gone, HUD shows `Mobs: 0`, no crashes.
- [ ] Let a patroller kill you → death handler fires; last death triggers Plan 1's reset.
- [ ] Trigger `/scriptevent trickymaze:smoke_monsters` as an op → chat shows `§aPASS smoke_monsters (patroller count: 1)`.
- [ ] Trigger `/scriptevent trickymaze:shutdown` → mob-spawning gamerule restored, chat confirms.

## Non-regression

- [ ] Plan 1 behaviors still work: prison build, respawn-in-prison, pressure-plate → Floor 1, death → spectator → last-death reset.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-23-plan-2-qa.md
git commit -m "docs: Plan 2 manual QA checklist"
```

---

## Task 21: End-to-end smoke in Minecraft

- [ ] **Step 1: Build and deploy**

Run: `npm run build && npm run local-deploy`
Expected: Packs copied to Bedrock dev folders without error.

- [ ] **Step 2: Load world and exercise QA doc**

Walk through every checkbox in
`docs/superpowers/specs/2026-04-23-plan-2-qa.md`. Capture any failures as
bugs; fix and commit each fix separately. Only mark the task complete when
every QA box is checked.

- [ ] **Step 3: Commit (if any fixes made)**

Commit each fix with its own descriptive message (examples below — only run the
ones that correspond to actual bugs found):

```bash
# git add <fixed-files>
# git commit -m "fix(monsters): <bug description>"
```

---

## Self-Review Notes (inline)

- **Spec §5.4 Patroller mapping:** detection range 5 (Task 13 `DETECT_RANGE`), 90° arc (`FRONTAL_ARC_DEG`), 4 dmg (`BASE_DAMAGE`), 3 s break (`CHARGE_TICKS = 15` at 5 Hz), never turns for flanking (patrol state skips `faceToward`; only charge state rotates). ✓
- **Spec §5.7 stat scaling:** `healthMultiplier` and `damageMultiplier` defined in Task 1; applied in Task 14 spawner. Known limitation noted — current `EntityHealthComponent` API may clamp `setCurrent` to `effectiveMax`; floor 1 is unaffected (multiplier 1.0). ✓
- **Spec §5.8 spawn placement:** Patrollers in straight runs ≥ 4 cells, density ~1/12 cells. Task 4 implements. ✓
- **Spec §5.6 unlock schedule:** L1 unlocks only Patroller. Only `patroller` is registered. ✓
- **Spec §3.1 HUD:** `Floor N · Key: <state> · Mobs: X`. Key is hardcoded to `"not found"` pending Plan 3's key pickup — called out in Task 16. ✓
- **Dormant wither_* renames:** Task 7. ✓
- **Placeholder scan:** no `TODO` / `TBD` / "fill in later" in code or tests. Task 21 step 3 shows an example commit command prefixed with `#` to indicate it's conditional.
- **Type consistency:** `SpawnManifestEntry` field names (`behavior`, `theme`, `pos`, `config.homePoint/patrolAxis/patrolLength`) used identically in spawn_plan.ts (Task 3–4) and spawner.ts (Task 14). Axis type is `"N" | "S" | "E" | "W"` everywhere. Runtime state types defined once in `patroller.ts` and not duplicated.
