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
