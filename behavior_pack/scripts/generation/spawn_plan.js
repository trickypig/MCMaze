import { themeForFloor } from "./themes";
// A cell qualifies as part of a straight NS run interior iff it has only
// N+S open (E and W both walled). The run may be bounded at either end by
// a cell that is open on the opposite side as well (T-junction / corner).
function isNSThrough(cell) {
    return !cell.walls.N && !cell.walls.S && cell.walls.E && cell.walls.W;
}
function isEWThrough(cell) {
    return !cell.walls.E && !cell.walls.W && cell.walls.N && cell.walls.S;
}
function findStraightRuns(maze) {
    const W = maze.cells.length;
    const H = maze.cells[0].length;
    const out = [];
    // Scan NS runs column-by-column.
    for (let x = 0; x < W; x++) {
        let run = [];
        for (let y = 0; y < H; y++) {
            if (isNSThrough(maze.cells[x][y])) {
                run.push({ x, y });
            }
            else {
                if (run.length >= 4)
                    out.push({ axis: "NS", cells: run });
                run = [];
            }
        }
        if (run.length >= 4)
            out.push({ axis: "NS", cells: run });
    }
    // Scan EW runs row-by-row.
    for (let y = 0; y < H; y++) {
        let run = [];
        for (let x = 0; x < W; x++) {
            if (isEWThrough(maze.cells[x][y])) {
                run.push({ x, y });
            }
            else {
                if (run.length >= 4)
                    out.push({ axis: "EW", cells: run });
                run = [];
            }
        }
        if (run.length >= 4)
            out.push({ axis: "EW", cells: run });
    }
    return out;
}
function containsCoord(run, c) {
    return run.some((r) => r.x === c.x && r.y === c.y);
}
function shuffleInPlace(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}
function runToEntry(run, theme) {
    const mid = run.cells[Math.floor(run.cells.length / 2)];
    const cx = mid.x * 3 + 2;
    const cz = mid.y * 3 + 2;
    const cy = 1; // floor-relative Y (y=0 is the floor layer; y=1 is walkable).
    const axis = run.axis === "NS" ? "S" : "E";
    return {
        behavior: "patroller",
        theme,
        pos: { x: cx, y: cy, z: cz },
        config: {
            homePoint: { x: cx, y: cy, z: cz },
            patrolAxis: axis,
            patrolLength: run.cells.length * 3,
        },
    };
}
function stationaryEntry(behavior, cell, theme) {
    const cx = cell.x * 3 + 2;
    const cz = cell.y * 3 + 2;
    const cy = 1;
    return {
        behavior,
        theme,
        pos: { x: cx, y: cy, z: cz },
        config: {
            homePoint: { x: cx, y: cy, z: cz },
            patrolAxis: "N", // unused for non-patrollers; retained for type compat
            patrolLength: 0,
        },
    };
}
function coordKey(c) { return `${c.x},${c.y}`; }
export function buildSpawnManifest(maze, floor, rng) {
    const theme = themeForFloor(floor).id;
    const runs = findStraightRuns(maze).filter((r) => !containsCoord(r.cells, maze.entrance) &&
        !containsCoord(r.cells, maze.exit));
    const W = maze.cells.length;
    const H = maze.cells[0].length;
    const totalCells = W * H;
    const patrolTarget = Math.max(1, Math.floor(totalCells / 12));
    shuffleInPlace(runs, rng);
    const chosenRuns = runs.slice(0, patrolTarget);
    const out = chosenRuns.map((run) => runToEntry(run, theme));
    // Track cells already occupied so later behaviors don't collide.
    const taken = new Set();
    taken.add(coordKey(maze.entrance));
    taken.add(coordKey(maze.exit));
    for (const r of chosenRuns)
        for (const c of r.cells)
            taken.add(coordKey(c));
    const freeCells = () => {
        const out = [];
        for (let x = 0; x < W; x++) {
            for (let y = 0; y < H; y++) {
                const c = { x, y };
                if (!taken.has(coordKey(c)))
                    out.push(c);
            }
        }
        return out;
    };
    // Sleepers: floor 2+. Any free cell.
    if (floor >= 2) {
        const candidates = freeCells();
        shuffleInPlace(candidates, rng);
        const sleeperTarget = Math.max(1, Math.floor(totalCells / 24));
        for (const c of candidates.slice(0, sleeperTarget)) {
            taken.add(coordKey(c));
            out.push(stationaryEntry("sleeper", c, theme));
        }
    }
    // Sentry archers: floor 3+. Prefer dead-ends for sightlines; fall back
    // to free cells if dead-ends are exhausted.
    if (floor >= 3) {
        const deadEndPool = maze.deadEnds.filter((c) => !taken.has(coordKey(c)));
        shuffleInPlace(deadEndPool, rng);
        const archerTarget = Math.max(1, Math.floor(totalCells / 30));
        let placed = 0;
        for (const c of deadEndPool) {
            if (placed >= archerTarget)
                break;
            taken.add(coordKey(c));
            out.push(stationaryEntry("sentry_archer", c, theme));
            placed += 1;
        }
        if (placed < archerTarget) {
            const fallback = freeCells();
            shuffleInPlace(fallback, rng);
            for (const c of fallback) {
                if (placed >= archerTarget)
                    break;
                taken.add(coordKey(c));
                out.push(stationaryEntry("sentry_archer", c, theme));
                placed += 1;
            }
        }
    }
    return out;
}
