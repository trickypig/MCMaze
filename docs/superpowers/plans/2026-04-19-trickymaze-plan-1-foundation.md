# TrickyMaze Plan 1 — Foundation + First Playable Slice

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a playable vertical slice of TrickyMaze: a world where joining auto-builds a prison, stepping on a pressure plate generates Floor 1 and teleports players into it, dying drops players into spectator, and the last death triggers a countdown that rebuilds the prison and restores everyone to Floor 0.

**Architecture:** Bedrock behavior pack + resource pack pair. TypeScript sources under `src/` compile to `behavior_pack/scripts/`. Pure maze generation lives in a Minecraft-import-free module for node-level unit testing. Event/state layers are thin wrappers over the pure core.

**Tech Stack:** Minecraft Bedrock 1.21.100+, `@minecraft/server` ^2.0.0 (stable), TypeScript 5.x, vitest for unit tests, Node 20+ for tooling.

**Spec reference:** `docs/superpowers/specs/2026-04-19-trickymaze-design.md` — this plan implements §2, §3 (IDLE/PRISON/FLOOR_ACTIVE/RESETTING states only), §4 (pure + minimal theming), §9.1 (gamerule only), §10 (partial), §11.1 (unit tests only). Plans 2–5 cover descent, monsters, loot, atmosphere, and full anti-spawn.

---

## Prerequisites

The engineer should:
- Have **Node 20+** and **npm 10+** installed.
- Have **Minecraft Bedrock 1.21.100+** installed on Windows (the target dev platform).
- Know where Bedrock's `development_behavior_packs` and `development_resource_packs` folders live. On Windows they are typically:
  - `%LOCALAPPDATA%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_behavior_packs\`
  - `%LOCALAPPDATA%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_resource_packs\`
- Know how to enable "Content Log GUI" in Minecraft Settings → Creator to see script errors at runtime.

**Pack UUIDs** — use these exact values in manifests (generated for this project, stable):

- BP header: `6a5f4c20-3a15-4f12-b8e9-4d3b5a7c9e01`
- BP data module: `a1b2c3d4-e5f6-4789-90ab-cdef12345678`
- BP script module: `7c8d9e0f-1a2b-4c3d-8e9f-a0b1c2d3e4f5`
- RP header: `9f8e7d6c-5b4a-4312-abcd-ef1234567890`
- RP resources module: `f0e1d2c3-b4a5-4678-9012-3456789abcde`

---

## Directory Structure After Plan 1

```
maze/
  behavior_pack/
    manifest.json
    pack_icon.png            (placeholder 256×256, provided in repo as-is)
    scripts/                 (build output — gitignored inside BP? no, shipped)
      main.js
      state/run.js
      generation/maze.js
      generation/floor.js
      generation/prison.js
      events/death.js
      events/pressure_plate.js
  resource_pack/
    manifest.json
    pack_icon.png
  src/
    main.ts
    state/run.ts
    generation/maze.ts
    generation/floor.ts
    generation/prison.ts
    events/death.ts
    events/pressure_plate.ts
  tests/
    maze.test.ts
    run.test.ts
  scripts-dev/
    link-packs.ps1           (symlinks packs into dev folders)
    package.mjs              (builds .mcaddon)
  docs/
    superpowers/
      specs/...
      plans/...
  package.json
  tsconfig.json
  vitest.config.ts
  .gitignore
```

---

## Task 1: Initialize npm project and TypeScript

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "trickymaze",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "A Minecraft Bedrock add-on that turns the world into a descending maze dungeon.",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "package": "node scripts-dev/package.mjs",
    "link": "powershell -ExecutionPolicy Bypass -File scripts-dev/link-packs.ps1"
  },
  "devDependencies": {
    "@minecraft/server": "^2.0.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "behavior_pack/scripts",
    "rootDir": "src",
    "strict": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": false,
    "sourceMap": false,
    "removeComments": false,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["tests/**/*", "node_modules"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: `node_modules/` populates; no errors. `package-lock.json` created.

- [ ] **Step 4: Verify TypeScript runs**

Run: `npx tsc --version`
Expected: prints `Version 5.x.x`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json
git commit -m "chore: init npm project with TypeScript + Minecraft server types"
```

---

## Task 2: Add vitest configuration and sanity test

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/sanity.test.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
```

- [ ] **Step 2: Create sanity test at `tests/sanity.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("arithmetic works", () => {
    expect(2 + 2).toBe(4);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts tests/sanity.test.ts
git commit -m "chore: add vitest and sanity test"
```

---

## Task 3: Create behavior pack and resource pack manifests

**Files:**
- Create: `behavior_pack/manifest.json`
- Create: `resource_pack/manifest.json`
- Create: `behavior_pack/pack_icon.png` (placeholder — see step 3)
- Create: `resource_pack/pack_icon.png` (placeholder — see step 3)

- [ ] **Step 1: Create `behavior_pack/manifest.json`**

```json
{
  "format_version": 2,
  "header": {
    "name": "TrickyMaze BP",
    "description": "TrickyMaze — descending maze dungeon (behavior)",
    "uuid": "6a5f4c20-3a15-4f12-b8e9-4d3b5a7c9e01",
    "version": [0, 1, 0],
    "min_engine_version": [1, 21, 100]
  },
  "modules": [
    {
      "type": "data",
      "uuid": "a1b2c3d4-e5f6-4789-90ab-cdef12345678",
      "version": [0, 1, 0]
    },
    {
      "type": "script",
      "language": "javascript",
      "entry": "scripts/main.js",
      "uuid": "7c8d9e0f-1a2b-4c3d-8e9f-a0b1c2d3e4f5",
      "version": [0, 1, 0]
    }
  ],
  "dependencies": [
    {
      "module_name": "@minecraft/server",
      "version": "2.0.0"
    },
    {
      "uuid": "9f8e7d6c-5b4a-4312-abcd-ef1234567890",
      "version": [0, 1, 0]
    }
  ]
}
```

- [ ] **Step 2: Create `resource_pack/manifest.json`**

```json
{
  "format_version": 2,
  "header": {
    "name": "TrickyMaze RP",
    "description": "TrickyMaze — descending maze dungeon (resources)",
    "uuid": "9f8e7d6c-5b4a-4312-abcd-ef1234567890",
    "version": [0, 1, 0],
    "min_engine_version": [1, 21, 100]
  },
  "modules": [
    {
      "type": "resources",
      "uuid": "f0e1d2c3-b4a5-4678-9012-3456789abcde",
      "version": [0, 1, 0]
    }
  ]
}
```

- [ ] **Step 3: Add placeholder pack_icon.png files**

Use any 256×256 PNG. If none exists, create a solid color one with PowerShell:

```powershell
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(20, 20, 20))
$bmp.Save("behavior_pack/pack_icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save("resource_pack/pack_icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
```

- [ ] **Step 4: Commit**

```bash
git add behavior_pack/ resource_pack/
git commit -m "feat: add BP and RP manifests with paired UUIDs"
```

---

## Task 4: Create dev symlink script

**Files:**
- Create: `scripts-dev/link-packs.ps1`

- [ ] **Step 1: Create `scripts-dev/link-packs.ps1`**

```powershell
# Symlinks the BP and RP into Minecraft's development pack folders.
# Must be run as administrator OR with Developer Mode enabled in Windows.

$ErrorActionPreference = "Stop"

$comMojang = Join-Path $env:LOCALAPPDATA "Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang"
$devBP = Join-Path $comMojang "development_behavior_packs\TrickyMazeBP"
$devRP = Join-Path $comMojang "development_resource_packs\TrickyMazeRP"

$repoBP = Resolve-Path ".\behavior_pack"
$repoRP = Resolve-Path ".\resource_pack"

if (Test-Path $devBP) { Remove-Item $devBP -Recurse -Force }
if (Test-Path $devRP) { Remove-Item $devRP -Recurse -Force }

New-Item -ItemType SymbolicLink -Path $devBP -Target $repoBP | Out-Null
New-Item -ItemType SymbolicLink -Path $devRP -Target $repoRP | Out-Null

Write-Host "Linked:"
Write-Host "  BP -> $devBP"
Write-Host "  RP -> $devRP"
```

- [ ] **Step 2: Run the link script** (user action — not automated)

Run: `npm run link`
Expected: creates symlinks; prints both paths. If it fails with "privilege not held," the user should either enable Windows Developer Mode (Settings → Privacy → For developers) or run PowerShell as admin once.

- [ ] **Step 3: Commit**

```bash
git add scripts-dev/link-packs.ps1
git commit -m "chore: add pack symlink script for dev iteration"
```

---

## Task 5: Create minimal main.ts and verify it loads

**Files:**
- Create: `src/main.ts`

- [ ] **Step 1: Create `src/main.ts`**

```ts
import { world } from "@minecraft/server";

world.afterEvents.worldInitialize?.subscribe(() => {
  console.warn("[TrickyMaze] Script loaded.");
});

// Fallback sanity log for versions where worldInitialize fires before subscribe.
console.warn("[TrickyMaze] main.ts imported.");
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `behavior_pack/scripts/main.js` appears.

- [ ] **Step 3: Manually verify load in Minecraft**

User launches Minecraft → creates a new creative world → in world settings, enables both TrickyMaze BP and RP → turns on "Content Log GUI" in world settings → creates world → sees `[TrickyMaze] main.ts imported.` in the Content Log.

If the log does NOT appear, debug: check that the BP manifest's script module has the correct `entry` path and that `main.js` exists.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts behavior_pack/scripts/main.js
git commit -m "feat: minimal main.ts that logs on world load"
```

---

## Task 6: Write failing test for maze cell grid generation

**Files:**
- Create: `tests/maze.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { generateMaze, type Maze } from "../src/generation/maze";

// Seeded PRNG for determinism in tests — xorshift32.
function seededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

describe("generateMaze — cell grid shape", () => {
  it("produces a grid of the requested width and height", () => {
    const rng = seededRng(42);
    const maze: Maze = generateMaze(12, 12, rng);
    expect(maze.cells.length).toBe(12);
    expect(maze.cells[0].length).toBe(12);
  });

  it("every cell has four wall flags", () => {
    const rng = seededRng(42);
    const maze = generateMaze(5, 5, rng);
    for (const row of maze.cells) {
      for (const cell of row) {
        expect(typeof cell.walls.N).toBe("boolean");
        expect(typeof cell.walls.S).toBe("boolean");
        expect(typeof cell.walls.E).toBe("boolean");
        expect(typeof cell.walls.W).toBe("boolean");
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- maze.test`
Expected: FAIL with "Cannot find module ../src/generation/maze" (or similar).

---

## Task 7: Implement recursive-backtracking maze algorithm

**Files:**
- Create: `src/generation/maze.ts`

- [ ] **Step 1: Create the module**

```ts
export type Direction = "N" | "S" | "E" | "W";

export type Cell = {
  walls: { N: boolean; S: boolean; E: boolean; W: boolean };
};

export type Coord = { x: number; y: number };

export type Maze = {
  cells: Cell[][];
  entrance: Coord;
  exit: Coord;
  deadEnds: Coord[];
  bfsDistance: (cell: Coord) => number;
};

const DX: Record<Direction, number> = { N: 0, S: 0, E: 1, W: -1 };
const DY: Record<Direction, number> = { N: -1, S: 1, E: 0, W: 0 };
const OPPOSITE: Record<Direction, Direction> = {
  N: "S",
  S: "N",
  E: "W",
  W: "E",
};

/**
 * Recursive-backtracking maze. Width/height are in cells (not blocks).
 * rng() must return a float in [0, 1).
 */
export function generateMaze(
  width: number,
  height: number,
  rng: () => number,
): Maze {
  if (width < 2 || height < 2) {
    throw new Error("Maze requires width >= 2 and height >= 2");
  }

  const cells: Cell[][] = [];
  for (let x = 0; x < width; x++) {
    const col: Cell[] = [];
    for (let y = 0; y < height; y++) {
      col.push({ walls: { N: true, S: true, E: true, W: true } });
    }
    cells.push(col);
  }

  const visited: boolean[][] = Array.from({ length: width }, () =>
    Array<boolean>(height).fill(false),
  );

  const stack: Coord[] = [{ x: 0, y: 0 }];
  visited[0][0] = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = (["N", "S", "E", "W"] as Direction[]).filter((d) => {
      const nx = current.x + DX[d];
      const ny = current.y + DY[d];
      return (
        nx >= 0 &&
        ny >= 0 &&
        nx < width &&
        ny < height &&
        !visited[nx][ny]
      );
    });

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const dir = neighbors[Math.floor(rng() * neighbors.length)];
    const nx = current.x + DX[dir];
    const ny = current.y + DY[dir];

    cells[current.x][current.y].walls[dir] = false;
    cells[nx][ny].walls[OPPOSITE[dir]] = false;

    visited[nx][ny] = true;
    stack.push({ x: nx, y: ny });
  }

  const entrance: Coord = { x: 0, y: 0 };
  const { distances, furthest } = bfs(cells, entrance);
  const exit = furthest;
  const deadEnds = findDeadEnds(cells);
  const bfsDistance = (cell: Coord) => distances[cell.x][cell.y];

  return { cells, entrance, exit, deadEnds, bfsDistance };
}

function bfs(
  cells: Cell[][],
  start: Coord,
): { distances: number[][]; furthest: Coord } {
  const width = cells.length;
  const height = cells[0].length;
  const distances: number[][] = Array.from({ length: width }, () =>
    Array<number>(height).fill(-1),
  );
  distances[start.x][start.y] = 0;
  const queue: Coord[] = [start];
  let furthest = start;
  let furthestDist = 0;

  while (queue.length > 0) {
    const c = queue.shift()!;
    const d = distances[c.x][c.y];
    for (const dir of ["N", "S", "E", "W"] as Direction[]) {
      if (cells[c.x][c.y].walls[dir]) continue;
      const nx = c.x + DX[dir];
      const ny = c.y + DY[dir];
      if (distances[nx][ny] !== -1) continue;
      distances[nx][ny] = d + 1;
      if (d + 1 > furthestDist) {
        furthestDist = d + 1;
        furthest = { x: nx, y: ny };
      }
      queue.push({ x: nx, y: ny });
    }
  }

  return { distances, furthest };
}

function findDeadEnds(cells: Cell[][]): Coord[] {
  const out: Coord[] = [];
  for (let x = 0; x < cells.length; x++) {
    for (let y = 0; y < cells[0].length; y++) {
      const w = cells[x][y].walls;
      const openCount =
        (w.N ? 0 : 1) + (w.S ? 0 : 1) + (w.E ? 0 : 1) + (w.W ? 0 : 1);
      if (openCount === 1 && !(x === 0 && y === 0)) {
        out.push({ x, y });
      }
    }
  }
  return out;
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- maze.test`
Expected: 2 tests passing.

- [ ] **Step 3: Commit**

```bash
git add src/generation/maze.ts tests/maze.test.ts
git commit -m "feat(gen): recursive-backtracking maze with BFS-furthest exit"
```

---

## Task 8: Add connectivity and distance tests

**Files:**
- Modify: `tests/maze.test.ts`

- [ ] **Step 1: Append new tests**

Add to the end of `tests/maze.test.ts`:

```ts
describe("generateMaze — connectivity", () => {
  it("every cell is reachable from the entrance", () => {
    const rng = seededRng(99);
    const maze = generateMaze(10, 10, rng);
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        expect(maze.bfsDistance({ x, y })).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("exit is strictly further from entrance than most cells", () => {
    const rng = seededRng(99);
    const maze = generateMaze(10, 10, rng);
    const exitDist = maze.bfsDistance(maze.exit);
    expect(exitDist).toBeGreaterThan(0);
    // At least 80% of cells should be closer than or equal to the exit.
    let closer = 0;
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        if (maze.bfsDistance({ x, y }) <= exitDist) closer++;
      }
    }
    expect(closer / 100).toBeGreaterThanOrEqual(0.8);
  });

  it("entrance is not the exit", () => {
    const rng = seededRng(7);
    const maze = generateMaze(8, 8, rng);
    expect(maze.exit.x === 0 && maze.exit.y === 0).toBe(false);
  });

  it("finds at least one dead end for nontrivial sizes", () => {
    const rng = seededRng(7);
    const maze = generateMaze(12, 12, rng);
    expect(maze.deadEnds.length).toBeGreaterThan(0);
  });
});

describe("generateMaze — determinism", () => {
  it("same seed produces same maze", () => {
    const a = generateMaze(8, 8, seededRng(123));
    const b = generateMaze(8, 8, seededRng(123));
    expect(JSON.stringify(a.cells)).toBe(JSON.stringify(b.cells));
    expect(a.exit).toEqual(b.exit);
  });
});
```

- [ ] **Step 2: Run all maze tests**

Run: `npm test -- maze.test`
Expected: all tests pass (at least 7 total including Task 6's tests).

- [ ] **Step 3: Commit**

```bash
git add tests/maze.test.ts
git commit -m "test(gen): connectivity, distance, and determinism for maze"
```

---

## Task 9: Create RunState module with enum states and failing test

**Files:**
- Create: `tests/run.test.ts`
- Create: `src/state/run.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/run.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { RunState, RunPhase } from "../src/state/run";

describe("RunState", () => {
  let state: RunState;

  beforeEach(() => {
    state = new RunState();
  });

  it("starts in IDLE with floor 0 and empty alive set", () => {
    expect(state.phase).toBe(RunPhase.Idle);
    expect(state.floor).toBe(0);
    expect(state.aliveCount()).toBe(0);
  });

  it("transitions IDLE -> PRISON on enterPrison()", () => {
    state.enterPrison();
    expect(state.phase).toBe(RunPhase.Prison);
    expect(state.floor).toBe(0);
  });

  it("transitions PRISON -> FLOOR_ACTIVE on startFloor(1)", () => {
    state.enterPrison();
    state.startFloor(1);
    expect(state.phase).toBe(RunPhase.FloorActive);
    expect(state.floor).toBe(1);
  });

  it("tracks alive set add/remove", () => {
    state.enterPrison();
    state.markAlive("player-a");
    state.markAlive("player-b");
    expect(state.aliveCount()).toBe(2);
    state.markDead("player-a");
    expect(state.aliveCount()).toBe(1);
    expect(state.isAlive("player-a")).toBe(false);
    expect(state.isAlive("player-b")).toBe(true);
  });

  it("transitions FLOOR_ACTIVE -> RESETTING when last alive dies", () => {
    state.enterPrison();
    state.markAlive("player-a");
    state.startFloor(1);
    state.markDead("player-a");
    expect(state.phase).toBe(RunPhase.Resetting);
  });

  it("reset() clears floor and alive set back to prison defaults", () => {
    state.enterPrison();
    state.markAlive("player-a");
    state.startFloor(3);
    state.markDead("player-a");
    state.reset();
    expect(state.phase).toBe(RunPhase.Prison);
    expect(state.floor).toBe(0);
    expect(state.aliveCount()).toBe(0);
  });

  it("serialize/hydrate roundtrip preserves phase and floor", () => {
    state.enterPrison();
    state.startFloor(2);
    const blob = state.serialize();
    const restored = RunState.hydrate(blob);
    expect(restored.phase).toBe(RunPhase.FloorActive);
    expect(restored.floor).toBe(2);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- run.test`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the module**

Create `src/state/run.ts`:

```ts
export enum RunPhase {
  Idle = "IDLE",
  Prison = "PRISON",
  FloorActive = "FLOOR_ACTIVE",
  Descending = "DESCENDING",
  Resetting = "RESETTING",
}

export type RunStateBlob = {
  phase: RunPhase;
  floor: number;
};

export class RunState {
  phase: RunPhase = RunPhase.Idle;
  floor: number = 0;
  private alive = new Set<string>();

  enterPrison(): void {
    this.phase = RunPhase.Prison;
    this.floor = 0;
  }

  startFloor(n: number): void {
    if (this.phase !== RunPhase.Prison && this.phase !== RunPhase.FloorActive) {
      throw new Error(`Cannot startFloor from ${this.phase}`);
    }
    this.floor = n;
    this.phase = RunPhase.FloorActive;
  }

  beginDescent(): void {
    if (this.phase !== RunPhase.FloorActive) {
      throw new Error(`Cannot beginDescent from ${this.phase}`);
    }
    this.phase = RunPhase.Descending;
  }

  markAlive(playerId: string): void {
    this.alive.add(playerId);
  }

  markDead(playerId: string): void {
    this.alive.delete(playerId);
    if (
      this.phase === RunPhase.FloorActive &&
      this.alive.size === 0
    ) {
      this.phase = RunPhase.Resetting;
    }
  }

  isAlive(playerId: string): boolean {
    return this.alive.has(playerId);
  }

  aliveCount(): number {
    return this.alive.size;
  }

  reset(): void {
    this.alive.clear();
    this.phase = RunPhase.Prison;
    this.floor = 0;
  }

  serialize(): RunStateBlob {
    return { phase: this.phase, floor: this.floor };
  }

  static hydrate(blob: RunStateBlob): RunState {
    const s = new RunState();
    s.phase = blob.phase;
    s.floor = blob.floor;
    return s;
  }
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npm test -- run.test`
Expected: all 7 RunState tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/state/run.ts tests/run.test.ts
git commit -m "feat(state): RunState with phase machine and persistence blob"
```

---

## Task 10: Create pure floor-builder module and test

**Files:**
- Create: `src/generation/floor.ts`
- Modify: `tests/maze.test.ts` (append)

The floor builder is *pure*: it takes a maze and emits a list of block fill operations. Actual Minecraft API calls happen in Task 15 (integration layer).

- [ ] **Step 1: Add a failing test to `tests/maze.test.ts`**

Append to `tests/maze.test.ts`:

```ts
import { buildFloor, type FloorSpec } from "../src/generation/floor";

describe("buildFloor", () => {
  it("produces a volume that matches (3N+1) x (3M+1)", () => {
    const rng = seededRng(42);
    const maze = generateMaze(5, 5, rng);
    const spec: FloorSpec = buildFloor(maze, {
      anchor: { x: 0, y: -50, z: 0 },
      wallBlock: "minecraft:stone_bricks",
      floorBlock: "minecraft:stone_bricks",
      ceilingBlock: "minecraft:stone_bricks",
    });
    const { min, max } = spec.bounds;
    expect(max.x - min.x + 1).toBe(16); // 3*5+1
    expect(max.z - min.z + 1).toBe(16);
    expect(max.y - min.y + 1).toBe(5); // floor + 3 air + ceiling
  });

  it("emits at least one wall operation", () => {
    const rng = seededRng(42);
    const maze = generateMaze(5, 5, rng);
    const spec = buildFloor(maze, {
      anchor: { x: 0, y: -50, z: 0 },
      wallBlock: "minecraft:stone_bricks",
      floorBlock: "minecraft:stone_bricks",
      ceilingBlock: "minecraft:stone_bricks",
    });
    expect(spec.operations.length).toBeGreaterThan(0);
    expect(spec.operations.some((op) => op.block === "minecraft:stone_bricks")).toBe(
      true,
    );
  });

  it("marks an entrance and an exit block position", () => {
    const rng = seededRng(42);
    const maze = generateMaze(5, 5, rng);
    const spec = buildFloor(maze, {
      anchor: { x: 0, y: -50, z: 0 },
      wallBlock: "minecraft:stone_bricks",
      floorBlock: "minecraft:stone_bricks",
      ceilingBlock: "minecraft:stone_bricks",
    });
    expect(spec.entranceBlock).toBeDefined();
    expect(spec.exitBlock).toBeDefined();
    expect(spec.entranceBlock).not.toEqual(spec.exitBlock);
  });
});
```

- [ ] **Step 2: Run and confirm fail**

Run: `npm test -- maze.test`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/generation/floor.ts`**

```ts
import type { Coord, Maze } from "./maze";

export type Vec3 = { x: number; y: number; z: number };

export type FloorConfig = {
  anchor: Vec3;
  wallBlock: string;
  floorBlock: string;
  ceilingBlock: string;
};

export type FillOp = {
  min: Vec3;
  max: Vec3;
  block: string;
};

export type FloorSpec = {
  operations: FillOp[];
  bounds: { min: Vec3; max: Vec3 };
  entranceBlock: Vec3;
  exitBlock: Vec3;
};

/**
 * Translates a maze into a set of fill operations anchored at `anchor`.
 * Cell (x, y) maps to block region
 *   [anchor.x + 3x .. anchor.x + 3x + 2]
 *   [anchor.z + 3y .. anchor.z + 3y + 2]
 * Walls are 1 block thick on the high edge of each cell and shared with the
 * next cell. A solid outer perimeter is added.
 */
export function buildFloor(maze: Maze, cfg: FloorConfig): FloorSpec {
  const W = maze.cells.length;
  const H = maze.cells[0].length;
  const sizeX = 3 * W + 1;
  const sizeZ = 3 * H + 1;
  const a = cfg.anchor;

  const ops: FillOp[] = [];

  // 1. Clear volume with air.
  ops.push({
    min: { x: a.x, y: a.y, z: a.z },
    max: { x: a.x + sizeX - 1, y: a.y + 4, z: a.z + sizeZ - 1 },
    block: "minecraft:air",
  });

  // 2. Floor layer.
  ops.push({
    min: { x: a.x, y: a.y, z: a.z },
    max: { x: a.x + sizeX - 1, y: a.y, z: a.z + sizeZ - 1 },
    block: cfg.floorBlock,
  });

  // 3. Ceiling layer.
  ops.push({
    min: { x: a.x, y: a.y + 4, z: a.z },
    max: { x: a.x + sizeX - 1, y: a.y + 4, z: a.z + sizeZ - 1 },
    block: cfg.ceilingBlock,
  });

  // 4. Full wall grid (we'll carve passages next).
  // Draw a lattice: every N/S/E/W wall that still stands becomes a block column.
  for (let cx = 0; cx < W; cx++) {
    for (let cy = 0; cy < H; cy++) {
      const cell = maze.cells[cx][cy];
      const ox = a.x + cx * 3;
      const oz = a.z + cy * 3;

      // Corner pillar at (ox, oz)
      ops.push({
        min: { x: ox, y: a.y + 1, z: oz },
        max: { x: ox, y: a.y + 3, z: oz },
        block: cfg.wallBlock,
      });

      // North wall at z = oz, spanning x = ox+1..ox+3 if cell.walls.N
      if (cell.walls.N) {
        ops.push({
          min: { x: ox + 1, y: a.y + 1, z: oz },
          max: { x: ox + 3, y: a.y + 3, z: oz },
          block: cfg.wallBlock,
        });
      }
      // West wall at x = ox, spanning z = oz+1..oz+3 if cell.walls.W
      if (cell.walls.W) {
        ops.push({
          min: { x: ox, y: a.y + 1, z: oz + 1 },
          max: { x: ox, y: a.y + 3, z: oz + 3 },
          block: cfg.wallBlock,
        });
      }
    }
  }
  // Outer south and east walls (the last row/col doesn't emit those from cells).
  ops.push({
    min: { x: a.x, y: a.y + 1, z: a.z + sizeZ - 1 },
    max: { x: a.x + sizeX - 1, y: a.y + 3, z: a.z + sizeZ - 1 },
    block: cfg.wallBlock,
  });
  ops.push({
    min: { x: a.x + sizeX - 1, y: a.y + 1, z: a.z },
    max: { x: a.x + sizeX - 1, y: a.y + 3, z: a.z + sizeZ - 1 },
    block: cfg.wallBlock,
  });

  // Entrance/exit center coords (on the floor of each cell).
  const entranceBlock: Vec3 = cellCenter(maze.entrance, a);
  const exitBlock: Vec3 = cellCenter(maze.exit, a);

  return {
    operations: ops,
    bounds: {
      min: { x: a.x, y: a.y, z: a.z },
      max: { x: a.x + sizeX - 1, y: a.y + 4, z: a.z + sizeZ - 1 },
    },
    entranceBlock,
    exitBlock,
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

- [ ] **Step 4: Run tests**

Run: `npm test -- maze.test`
Expected: all new buildFloor tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/generation/floor.ts tests/maze.test.ts
git commit -m "feat(gen): pure floor-builder emits fill ops from maze graph"
```

---

## Task 11: Create pure prison-builder module and test

**Files:**
- Create: `src/generation/prison.ts`
- Modify: `tests/maze.test.ts` (append)

The prison is a fixed 7×7 stone-brick room with iron bars on windows, a pressure plate in front of an iron door, and a sign.

- [ ] **Step 1: Add failing tests**

Append to `tests/maze.test.ts`:

```ts
import { buildPrison, type PrisonSpec } from "../src/generation/prison";

describe("buildPrison", () => {
  it("has a 7x7 footprint, 5 tall", () => {
    const spec: PrisonSpec = buildPrison({ x: 0, y: -50, z: 0 });
    const { min, max } = spec.bounds;
    expect(max.x - min.x + 1).toBe(7);
    expect(max.z - min.z + 1).toBe(7);
    expect(max.y - min.y + 1).toBe(5);
  });

  it("exposes a spawn position inside the room", () => {
    const spec = buildPrison({ x: 0, y: -50, z: 0 });
    const p = spec.spawnPos;
    expect(p.x).toBeGreaterThan(spec.bounds.min.x);
    expect(p.x).toBeLessThan(spec.bounds.max.x);
    expect(p.z).toBeGreaterThan(spec.bounds.min.z);
    expect(p.z).toBeLessThan(spec.bounds.max.z);
  });

  it("exposes door position and pressure-plate position", () => {
    const spec = buildPrison({ x: 0, y: -50, z: 0 });
    expect(spec.doorPos).toBeDefined();
    expect(spec.pressurePlatePos).toBeDefined();
    // Pressure plate sits on the floor, door directly beside it on same y.
    expect(spec.pressurePlatePos.y).toBe(spec.spawnPos.y);
  });
});
```

- [ ] **Step 2: Run to confirm fail**

Run: `npm test -- maze.test`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/generation/prison.ts`**

```ts
import type { FillOp, Vec3 } from "./floor";

export type PrisonSpec = {
  operations: FillOp[];
  bounds: { min: Vec3; max: Vec3 };
  spawnPos: Vec3;
  doorPos: Vec3;
  pressurePlatePos: Vec3;
};

/**
 * Builds a 7x7x5 prison room at `anchor` (min corner).
 * Interior is 5x5x3. North wall (low-z edge) has an iron door with a
 * pressure plate one block inside the room.
 */
export function buildPrison(anchor: Vec3): PrisonSpec {
  const a = anchor;
  const ops: FillOp[] = [];

  // Hollow cube: fill solid then carve interior.
  ops.push({
    min: { x: a.x, y: a.y, z: a.z },
    max: { x: a.x + 6, y: a.y + 4, z: a.z + 6 },
    block: "minecraft:stone_bricks",
  });
  ops.push({
    min: { x: a.x + 1, y: a.y + 1, z: a.z + 1 },
    max: { x: a.x + 5, y: a.y + 3, z: a.z + 5 },
    block: "minecraft:air",
  });

  // Floor = stone bricks (already there from solid fill).
  // Iron bar windows (east + west walls, middle of the wall).
  ops.push({
    min: { x: a.x, y: a.y + 2, z: a.z + 3 },
    max: { x: a.x, y: a.y + 2, z: a.z + 3 },
    block: "minecraft:iron_bars",
  });
  ops.push({
    min: { x: a.x + 6, y: a.y + 2, z: a.z + 3 },
    max: { x: a.x + 6, y: a.y + 2, z: a.z + 3 },
    block: "minecraft:iron_bars",
  });

  // Door opening on north wall (low-z edge) at x = a.x + 3.
  const doorX = a.x + 3;
  const doorZ = a.z;
  // Carve 2-tall opening.
  ops.push({
    min: { x: doorX, y: a.y + 1, z: doorZ },
    max: { x: doorX, y: a.y + 2, z: doorZ },
    block: "minecraft:air",
  });
  // Place iron door (lower half). Upper half auto-placed by Bedrock.
  ops.push({
    min: { x: doorX, y: a.y + 1, z: doorZ },
    max: { x: doorX, y: a.y + 1, z: doorZ },
    block: "minecraft:iron_door",
  });

  // Pressure plate one block inside the door.
  const plateX = a.x + 3;
  const plateY = a.y + 1;
  const plateZ = a.z + 1;
  ops.push({
    min: { x: plateX, y: plateY, z: plateZ },
    max: { x: plateX, y: plateY, z: plateZ },
    block: "minecraft:heavy_weighted_pressure_plate",
  });

  // Spawn in center of room, facing north.
  const spawnPos: Vec3 = { x: a.x + 3, y: a.y + 1, z: a.z + 3 };

  return {
    operations: ops,
    bounds: {
      min: { x: a.x, y: a.y, z: a.z },
      max: { x: a.x + 6, y: a.y + 4, z: a.z + 6 },
    },
    spawnPos,
    doorPos: { x: doorX, y: a.y + 1, z: doorZ },
    pressurePlatePos: { x: plateX, y: plateY, z: plateZ },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- maze.test`
Expected: all prison tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/generation/prison.ts tests/maze.test.ts
git commit -m "feat(gen): pure prison-builder (7x7 stone-brick room + iron door)"
```

---

## Task 12: Add world-facing wrapper for fill operations

**Files:**
- Create: `src/generation/world_writer.ts`

This is the thin integration layer that turns pure `FillOp`s into actual Minecraft API calls. It handles the `fillBlocks` volume cap (32,768 blocks per call) by chunking.

- [ ] **Step 1: Create `src/generation/world_writer.ts`**

```ts
import { world, BlockPermutation } from "@minecraft/server";
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
    dim.fillBlocks(min, max, perm);
  } catch (e) {
    console.warn(
      `[TrickyMaze] fillBlocks failed at (${min.x},${min.y},${min.z})->(${max.x},${max.y},${max.z}) with ${blockId}: ${String(e)}`,
    );
  }
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `behavior_pack/scripts/generation/world_writer.js` appears, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/generation/world_writer.ts behavior_pack/scripts/generation/
git commit -m "feat(gen): world_writer applies FillOps with 32k-volume chunking"
```

---

## Task 13: Wire RunState into main.ts with dynamic property persistence

**Files:**
- Modify: `src/main.ts`
- Create: `src/state/persistence.ts`

- [ ] **Step 1: Create `src/state/persistence.ts`**

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
    return RunState.hydrate(blob);
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

- [ ] **Step 2: Rewrite `src/main.ts`**

```ts
import { world, system } from "@minecraft/server";
import { loadRunState, saveRunState } from "./state/persistence";
import { RunPhase, RunState } from "./state/run";

export const runState: RunState = loadRunState();

system.run(() => {
  console.warn(`[TrickyMaze] Initialized. phase=${runState.phase} floor=${runState.floor}`);
});

// Placeholder: subsequent tasks hook events here.
world.afterEvents.playerSpawn.subscribe((ev) => {
  console.warn(`[TrickyMaze] playerSpawn: ${ev.player.name} (init=${ev.initialSpawn})`);
});

// Persist on any state change — convenience helper.
export function commitState(): void {
  saveRunState(runState);
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: main.js and state/*.js appear under `behavior_pack/scripts/`.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts src/state/persistence.ts behavior_pack/scripts/
git commit -m "feat(state): persist RunState via dynamic property + wire into main"
```

---

## Task 14: Build prison on first player spawn

**Files:**
- Modify: `src/main.ts`
- Create: `src/events/first_join.ts`

The anchor point lives at `X=10000, Y=-50, Z=10000`. The prison sits at the anchor; floors will stack downward starting at `Y=-56`.

- [ ] **Step 1: Create `src/events/first_join.ts`**

```ts
import { world, GameMode, system } from "@minecraft/server";
import type { Vec3 } from "../generation/floor";
import { buildPrison } from "../generation/prison";
import { applyOps } from "../generation/world_writer";
import { RunPhase, RunState } from "../state/run";
import { commitState } from "../main";

export const ANCHOR: Vec3 = { x: 10000, y: -50, z: 10000 };
const TICKING_AREA_NAME = "trickymaze_anchor";
const FLOOR_Y_SPAN = 150; // Covers prison + ~20 stacked floors.

export function handleFirstJoin(state: RunState): void {
  if (state.phase !== RunPhase.Idle) return;

  console.warn("[TrickyMaze] First join detected — building prison.");

  const dim = world.getDimension("overworld");

  // Force-load the anchor region (§4.6 chunk loading) so fillBlocks and
  // teleports don't race against chunk unload. `remove` may fail the first
  // time through (nothing to remove) — that's fine.
  try {
    dim.runCommand(`tickingarea remove ${TICKING_AREA_NAME}`);
  } catch {
    /* no existing area — ignore */
  }
  dim.runCommand(
    `tickingarea add ${ANCHOR.x - 10} ${ANCHOR.y - FLOOR_Y_SPAN} ${ANCHOR.z - 10} ` +
      `${ANCHOR.x + 140} ${ANCHOR.y + 10} ${ANCHOR.z + 140} ${TICKING_AREA_NAME} true`,
  );

  const prison = buildPrison(ANCHOR);
  applyOps(prison.operations);
  state.enterPrison();
  commitState();

  // Disable natural mob spawning world-wide for this session (§9.1).
  dim.runCommand("gamerule dommobspawning false");

  // Teleport all connected players into the prison, adventure mode, give bread.
  system.runTimeout(() => {
    for (const p of world.getAllPlayers()) {
      p.teleport(prison.spawnPos, { dimension: dim });
      p.setGameMode(GameMode.adventure);
      const inv = p.getComponent("minecraft:inventory")?.container;
      inv?.clearAll();
      p.runCommand("give @s bread 8");
      state.markAlive(p.id);
    }
    commitState();
  }, 20); // 1-second delay so the world is loaded when we teleport.
}
```

- [ ] **Step 2: Wire into `src/main.ts`**

Replace the existing `playerSpawn` handler block in `src/main.ts` with:

```ts
import { handleFirstJoin } from "./events/first_join";

world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  if (runState.phase === RunPhase.Idle) {
    handleFirstJoin(runState);
  } else {
    // Mid-run join — will be addressed in Plan 2. For now, just acknowledge.
    console.warn(`[TrickyMaze] Mid-run join by ${ev.player.name} — not handled in Plan 1.`);
  }
});
```

The full file should now be:

```ts
import { world, system } from "@minecraft/server";
import { loadRunState, saveRunState } from "./state/persistence";
import { RunPhase, RunState } from "./state/run";
import { handleFirstJoin } from "./events/first_join";

export const runState: RunState = loadRunState();

system.run(() => {
  console.warn(`[TrickyMaze] Initialized. phase=${runState.phase} floor=${runState.floor}`);
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  if (runState.phase === RunPhase.Idle) {
    handleFirstJoin(runState);
  } else {
    console.warn(`[TrickyMaze] Mid-run join by ${ev.player.name} — not handled in Plan 1.`);
  }
});

export function commitState(): void {
  saveRunState(runState);
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds; `behavior_pack/scripts/events/first_join.js` exists.

- [ ] **Step 4: Manual QA — prison spawn**

1. Apply the link script: `npm run link` (if not already).
2. Create a new world in Minecraft with TrickyMaze BP + RP active and "Beta APIs" OFF.
3. Watch for `[TrickyMaze] First join detected — building prison.` in the Content Log.
4. After ~1 second, you should be teleported to a stone-brick room at `X=10000, Y=-49, Z=10003`.
5. Open your inventory — should contain only 8 bread.
6. Gamemode should be adventure (cannot break blocks).

If teleport fails (you remain in the overworld): verify `ANCHOR` dimension loading — try `/tickingarea add 9990 -55 9990 10030 -45 10030 trickymaze_area true` in a creative world to force-load the region, then replay.

- [ ] **Step 5: Commit**

```bash
git add src/events/first_join.ts src/main.ts behavior_pack/scripts/
git commit -m "feat(events): first-join auto-builds prison and teleports players"
```

---

## Task 15: Build Floor 1 when pressure plate is pressed

**Files:**
- Create: `src/events/pressure_plate.ts`
- Modify: `src/events/first_join.ts` (export prison ref)
- Modify: `src/main.ts`

- [ ] **Step 1: Expose prison position from first_join**

Modify `src/events/first_join.ts` — at the top of the module, add a mutable export and set it when the prison is built:

```ts
// ... existing imports
import type { PrisonSpec } from "../generation/prison";

export let prisonSpec: PrisonSpec | null = null;

// ... inside handleFirstJoin, after `const prison = buildPrison(ANCHOR);`:
prisonSpec = prison;
```

- [ ] **Step 2: Create `src/events/pressure_plate.ts`**

```ts
import { world, GameMode } from "@minecraft/server";
import { ANCHOR, prisonSpec } from "./first_join";
import { RunPhase, type RunState } from "../state/run";
import { buildFloor } from "../generation/floor";
import { generateMaze } from "../generation/maze";
import { applyOps } from "../generation/world_writer";
import { commitState, runState } from "../main";
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

  // Teleport all living players to the entrance.
  const entrance = spec.entranceBlock;
  for (const p of world.getAllPlayers()) {
    if (!state.isAlive(p.id)) continue;
    p.teleport(
      { x: entrance.x + 0.5, y: entrance.y, z: entrance.z + 0.5 },
      { dimension: world.getDimension("overworld") },
    );
    p.setGameMode(GameMode.adventure);
  }

  world.sendMessage(`§6You descend into the maze. Floor ${floorNum}.`);
}
```

- [ ] **Step 3: Create a seeded RNG helper at `src/generation/rng.ts`**

```ts
/**
 * xorshift32 seeded RNG. Deterministic for a given seed.
 * Used so floors generate identically for replay/debug.
 */
export function seededRng(seed: number): () => number {
  let s = seed | 0;
  if (s === 0) s = 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

/**
 * Seeded from floor number only (world seed not readable from script API).
 * A single run is reproducible; different worlds with same floor get the same maze.
 * That's acceptable for v1.
 */
export function worldSeededRng(floorNumber: number): () => number {
  return seededRng(0xBADC0DE ^ (floorNumber * 2654435761));
}
```

- [ ] **Step 4: Hook the pressure plate into main.ts**

In `src/main.ts`, add:

```ts
import { handlePressurePlate } from "./events/pressure_plate";
import { prisonSpec } from "./events/first_join";

world.afterEvents.playerInteractWithBlock?.subscribe((ev) => {
  // Pressure plates fire as step-on events, not interact. Use itemUseOn? No — use activating event.
});

// Pressure plates don't have a dedicated "stepped on" event. Use the
// button-style buttonPush event for heavy weighted plates — or fall back
// to polling the block location for a player standing on it.
// For Plan 1 we poll once per second.
import { system } from "@minecraft/server";

system.runInterval(() => {
  if (runState.phase !== RunPhase.Prison) return;
  if (!prisonSpec) return;
  const plate = prisonSpec.pressurePlatePos;
  const dim = world.getDimension("overworld");
  for (const p of world.getAllPlayers()) {
    const loc = p.location;
    if (
      Math.floor(loc.x) === plate.x &&
      Math.floor(loc.y) === plate.y &&
      Math.floor(loc.z) === plate.z
    ) {
      handlePressurePlate(runState);
      break;
    }
  }
}, 20); // Once per second.
```

Full final `src/main.ts`:

```ts
import { world, system } from "@minecraft/server";
import { loadRunState, saveRunState } from "./state/persistence";
import { RunPhase, RunState } from "./state/run";
import { handleFirstJoin, prisonSpec } from "./events/first_join";
import { handlePressurePlate } from "./events/pressure_plate";

export const runState: RunState = loadRunState();

system.run(() => {
  console.warn(`[TrickyMaze] Initialized. phase=${runState.phase} floor=${runState.floor}`);
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  if (runState.phase === RunPhase.Idle) {
    handleFirstJoin(runState);
  } else {
    console.warn(`[TrickyMaze] Mid-run join by ${ev.player.name} — not handled in Plan 1.`);
  }
});

system.runInterval(() => {
  if (runState.phase !== RunPhase.Prison) return;
  if (!prisonSpec) return;
  const plate = prisonSpec.pressurePlatePos;
  for (const p of world.getAllPlayers()) {
    const loc = p.location;
    if (
      Math.floor(loc.x) === plate.x &&
      Math.floor(loc.y) === plate.y &&
      Math.floor(loc.z) === plate.z
    ) {
      handlePressurePlate(runState);
      break;
    }
  }
}, 20);

export function commitState(): void {
  saveRunState(runState);
}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: all modules compile.

- [ ] **Step 6: Manual QA — floor generation**

1. Re-enter the prison world (remove previous world, make a new one so `worldInitialize` fires cleanly).
2. Step on the pressure plate.
3. Within a couple of seconds you should be teleported to a cell in a stone-brick maze at `Y ≈ -56`.
4. Explore — verify you can walk through corridors and hit dead-end walls.
5. Confirm `Floor 1.` message in chat.

- [ ] **Step 7: Commit**

```bash
git add src/events/pressure_plate.ts src/events/first_join.ts src/main.ts src/generation/rng.ts behavior_pack/scripts/
git commit -m "feat(events): pressure plate generates Floor 1 and teleports players"
```

---

## Task 16: Track player death and switch to spectator

**Files:**
- Create: `src/events/death.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create `src/events/death.ts`**

```ts
import { world, GameMode, Player, system } from "@minecraft/server";
import { RunPhase, type RunState } from "../state/run";
import { commitState } from "../main";
import { ANCHOR, prisonSpec } from "./first_join";
import { applyOps } from "../generation/world_writer";
import type { FillOp } from "../generation/floor";

const RESET_SECONDS = 5;
const MAX_DESCENT_FLOORS = 20;
const FLOOR_Y_GAP = 6;

export function registerDeathHandlers(state: RunState): void {
  world.afterEvents.entityDie.subscribe((ev) => {
    const entity = ev.deadEntity;
    if (!(entity instanceof Player)) return;
    if (state.phase !== RunPhase.FloorActive) return;

    console.warn(`[TrickyMaze] Player died: ${entity.name}`);
    state.markDead(entity.id);
    commitState();

    // Immediately set them to spectator (the death screen will briefly show).
    system.runTimeout(() => {
      try {
        entity.setGameMode(GameMode.spectator);
      } catch (e) {
        console.warn(`[TrickyMaze] Failed to set spectator: ${String(e)}`);
      }
    }, 10);

    if (state.phase === RunPhase.Resetting) {
      console.warn("[TrickyMaze] Last player died — starting reset countdown.");
      startResetCountdown(state);
    }
  });

  world.afterEvents.playerLeave?.subscribe((ev) => {
    state.markDead(ev.playerId);
    commitState();
    if (state.phase === RunPhase.Resetting) {
      startResetCountdown(state);
    }
  });
}

function startResetCountdown(state: RunState): void {
  let remaining = RESET_SECONDS;
  const id = system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      p.onScreenDisplay.setActionBar(`§cRespawning in ${remaining}…`);
    }
    remaining--;
    if (remaining < 0) {
      system.clearRun(id);
      performReset(state);
    }
  }, 20);
}

function performReset(state: RunState): void {
  console.warn("[TrickyMaze] Performing reset.");

  // Demolish all possible floor volumes back to air.
  const ops: FillOp[] = [];
  for (let n = 1; n <= MAX_DESCENT_FLOORS; n++) {
    ops.push({
      min: {
        x: ANCHOR.x - 5,
        y: ANCHOR.y - FLOOR_Y_GAP * n - 1,
        z: ANCHOR.z - 5,
      },
      max: {
        x: ANCHOR.x + 125,
        y: ANCHOR.y - FLOOR_Y_GAP * n + 5,
        z: ANCHOR.z + 125,
      },
      block: "minecraft:air",
    });
  }
  applyOps(ops);

  state.reset();
  commitState();

  if (!prisonSpec) return;

  for (const p of world.getAllPlayers()) {
    p.setGameMode(GameMode.adventure);
    p.teleport(prisonSpec.spawnPos, {
      dimension: world.getDimension("overworld"),
    });
    const inv = p.getComponent("minecraft:inventory")?.container;
    inv?.clearAll();
    p.runCommand("give @s bread 8");
    state.markAlive(p.id);
  }
  commitState();
  world.sendMessage("§7You wake up in the prison. The dungeon resets.");
}
```

- [ ] **Step 2: Register from main.ts**

In `src/main.ts`, add near the top after imports:

```ts
import { registerDeathHandlers } from "./events/death";

registerDeathHandlers(runState);
```

Final `src/main.ts`:

```ts
import { world, system } from "@minecraft/server";
import { loadRunState, saveRunState } from "./state/persistence";
import { RunPhase, RunState } from "./state/run";
import { handleFirstJoin, prisonSpec } from "./events/first_join";
import { handlePressurePlate } from "./events/pressure_plate";
import { registerDeathHandlers } from "./events/death";

export const runState: RunState = loadRunState();
registerDeathHandlers(runState);

system.run(() => {
  console.warn(`[TrickyMaze] Initialized. phase=${runState.phase} floor=${runState.floor}`);
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  if (runState.phase === RunPhase.Idle) {
    handleFirstJoin(runState);
  } else {
    console.warn(`[TrickyMaze] Mid-run join by ${ev.player.name} — not handled in Plan 1.`);
  }
});

system.runInterval(() => {
  if (runState.phase !== RunPhase.Prison) return;
  if (!prisonSpec) return;
  const plate = prisonSpec.pressurePlatePos;
  for (const p of world.getAllPlayers()) {
    const loc = p.location;
    if (
      Math.floor(loc.x) === plate.x &&
      Math.floor(loc.y) === plate.y &&
      Math.floor(loc.z) === plate.z
    ) {
      handlePressurePlate(runState);
      break;
    }
  }
}, 20);

export function commitState(): void {
  saveRunState(runState);
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: builds cleanly.

- [ ] **Step 4: Manual QA — death and reset**

1. Start a new world. Prison builds, step on plate, enter Floor 1.
2. Once inside, type `/kill @s` (or jump off a ledge before we're walled in).
3. Verify you switch to spectator mode within ~0.5s.
4. Watch the actionbar — "Respawning in 5…4…3…2…1…0".
5. Confirm you're teleported back to the prison, adventure mode restored, inventory cleared to 8 bread, chat shows "You wake up in the prison."
6. Repeat with a second player (creative op spectator can join from outside to test): both must die for reset. Die alone — game should continue with them in spectator, no reset.

- [ ] **Step 5: Commit**

```bash
git add src/events/death.ts src/main.ts behavior_pack/scripts/
git commit -m "feat(events): death -> spectator; last-death triggers reset to prison"
```

---

## Task 17: Add shutdown scriptevent to restore `doMobSpawning`

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Subscribe to `scriptEventReceive`**

Append to `src/main.ts`:

```ts
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id === "trickymaze:shutdown") {
    world.getDimension("overworld").runCommand("gamerule dommobspawning true");
    world.sendMessage("§7TrickyMaze shutdown: mob spawning restored.");
    console.warn("[TrickyMaze] Shutdown event received; gamerule restored.");
  }
});
```

Note: `system.afterEvents.scriptEventReceive` is the correct 2.x location. Import `system` from `@minecraft/server` at the top of main.ts (already present).

- [ ] **Step 2: Build**

Run: `npm run build`

- [ ] **Step 3: Manual QA**

In a running world: `/scriptevent trickymaze:shutdown`
Expected: chat prints "TrickyMaze shutdown: mob spawning restored."; `/gamerule dommobspawning` reports `true`.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts behavior_pack/scripts/main.js
git commit -m "feat: /scriptevent trickymaze:shutdown restores doMobSpawning"
```

---

## Task 18: Add packaging script for `.mcaddon`

**Files:**
- Create: `scripts-dev/package.mjs`

- [ ] **Step 1: Create the script**

```js
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import archiver from "archiver";
import path from "node:path";

// archiver is not in devDeps by default — run `npm i -D archiver` first.

const DIST = "dist";
if (!existsSync(DIST)) mkdirSync(DIST);

function zipPack(srcDir, outName) {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(path.join(DIST, outName));
    const zip = archiver("zip", { zlib: { level: 9 } });
    out.on("close", () => resolve(out.bytesWritten));
    zip.on("error", reject);
    zip.pipe(out);
    zip.directory(srcDir, false);
    zip.finalize();
  });
}

async function main() {
  execSync("npm run build", { stdio: "inherit" });
  const bpBytes = await zipPack("behavior_pack", "TrickyMazeBP.mcpack");
  const rpBytes = await zipPack("resource_pack", "TrickyMazeRP.mcpack");
  console.log(`Built TrickyMazeBP.mcpack (${bpBytes} B)`);
  console.log(`Built TrickyMazeRP.mcpack (${rpBytes} B)`);

  // .mcaddon = zip of both .mcpack files
  const mcaddon = createWriteStream(path.join(DIST, "TrickyMaze.mcaddon"));
  const zip = archiver("zip", { zlib: { level: 9 } });
  const done = new Promise((res, rej) => {
    mcaddon.on("close", res);
    zip.on("error", rej);
  });
  zip.pipe(mcaddon);
  zip.file(path.join(DIST, "TrickyMazeBP.mcpack"), { name: "TrickyMazeBP.mcpack" });
  zip.file(path.join(DIST, "TrickyMazeRP.mcpack"), { name: "TrickyMazeRP.mcpack" });
  zip.finalize();
  await done;
  console.log("Built TrickyMaze.mcaddon");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Install `archiver`**

Run: `npm i -D archiver`
Expected: adds to devDependencies.

- [ ] **Step 3: Run the packager**

Run: `npm run package`
Expected: `dist/TrickyMazeBP.mcpack`, `dist/TrickyMazeRP.mcpack`, `dist/TrickyMaze.mcaddon` all appear.

- [ ] **Step 4: Commit**

```bash
git add scripts-dev/package.mjs package.json package-lock.json
git commit -m "chore: add package.mjs to build .mcpack and .mcaddon artifacts"
```

Note: `dist/` is gitignored — the artifacts themselves are not committed.

---

## Task 19: Manual QA checklist (vertical slice acceptance)

**Files:**
- Create: `docs/superpowers/plans/2026-04-19-trickymaze-plan-1-qa.md`

- [ ] **Step 1: Create the QA checklist**

```markdown
# TrickyMaze Plan 1 — Acceptance QA

Run each scenario in a fresh Minecraft world with TrickyMaze BP + RP active,
Beta APIs OFF, Content Log GUI ON.

## Scenario 1 — Solo first-join
- [ ] Create a new Creative world (we'll be forced to adventure by the script).
- [ ] Content Log shows `[TrickyMaze] First join detected — building prison.`
- [ ] Within 1–2s, player is teleported into a 5×5 stone-brick room.
- [ ] Gamemode is Adventure (attempt to break a block — should fail).
- [ ] Inventory contains exactly 8 bread.
- [ ] `/gamerule dommobspawning` reports `false`.

## Scenario 2 — Solo floor entry
- [ ] Walk onto the heavy weighted pressure plate.
- [ ] Chat shows `§6You descend into the maze. Floor 1.`
- [ ] Player is teleported to a stone-brick maze at ~Y=-56.
- [ ] Maze has walls; walking around reveals a 37×37 footprint.
- [ ] `/tp @s ~ ~ ~` shows coords near `(10000, -55, 10000)` ± some cells.

## Scenario 3 — Solo death triggers reset
- [ ] Run `/kill @s` inside the maze.
- [ ] Player enters Spectator mode briefly.
- [ ] Actionbar counts down `Respawning in 5` → `0`.
- [ ] Player is teleported back to the prison, Adventure restored, inventory = 8 bread.
- [ ] Chat shows `§7You wake up in the prison. The dungeon resets.`
- [ ] Walking back on the pressure plate generates a new Floor 1.

## Scenario 4 — Co-op partial death (2+ players)
- [ ] Have a second player join (same LAN/Realm world).
- [ ] Both step on pressure plate, enter Floor 1.
- [ ] Player A `/kill @s` — goes to Spectator. Player B remains Adventure on floor.
- [ ] No reset triggers; Player B can still walk around.
- [ ] Player B now `/kill @s` — countdown starts, both players returned to prison.

## Scenario 5 — World reload persists state
- [ ] Start a run to Floor 1.
- [ ] Save & quit world. Reopen.
- [ ] Content Log shows `phase=FLOOR_ACTIVE floor=1` on init.
- [ ] Player is still on the floor (or teleport to maze anchor manually to confirm structure survived).

## Scenario 6 — Shutdown command
- [ ] Run `/scriptevent trickymaze:shutdown`.
- [ ] Chat shows restoration message.
- [ ] `/gamerule dommobspawning` reports `true`.

## Known limitations (Plan 1)
- Mid-run joins are ignored (tolerated, logged).
- The end-of-floor iron door is decorative — you cannot descend to Floor 2 in Plan 1.
- No monsters, no loot chests, no themes beyond stone brick.
- No atmospheric sounds or descent broadcasts.
- All of the above are delivered in Plans 2–5.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-04-19-trickymaze-plan-1-qa.md
git commit -m "docs: acceptance QA checklist for Plan 1 vertical slice"
```

---

## Task 20: Self-test the test suite one more time

- [ ] **Step 1: Run full suite**

Run: `npm test`
Expected: all tests pass (sanity + maze + run ≈ 14 tests).

- [ ] **Step 2: Run build to confirm no stale output**

Run: `rm -rf behavior_pack/scripts && npm run build`
Expected: clean rebuild, all files regenerated.

- [ ] **Step 3: Run QA scenarios 1–6 from Task 19 manually.**

If all pass → Plan 1 is **done**. Move on to Plan 2 (descent flow + theming).

If a scenario fails → file a task in the TaskList describing the specific failure and what you've already tried. Do not skip scenarios.

- [ ] **Step 4: Final commit (if any fixes applied)**

```bash
git add -A
git commit -m "chore: Plan 1 QA sign-off — all scenarios passing"
```

---

## Plan 1 Complete

After all tasks above pass, TrickyMaze has:

- A buildable/packageable Bedrock add-on.
- A pure, unit-tested maze generator.
- A pure, unit-tested run state machine with persistence.
- A permanent stone-brick prison built on first world entry.
- Pressure-plate-driven Floor 1 generation.
- Adventure-mode enforcement with 8-bread starter inventory.
- Death → spectator → last-death → 5-second countdown → full reset loop.
- World-wide natural mob spawning disabled.
- A `/scriptevent trickymaze:shutdown` to restore normal behavior.

**Next:** Plan 2 adds the descent flow, key item, multi-floor progression, and per-floor theming. Spec sections covered in Plan 2: §4.5 (floor stacking), §5 is deferred to Plan 3, §6 (descent), §7 is deferred to Plan 4, §8 (themes).
