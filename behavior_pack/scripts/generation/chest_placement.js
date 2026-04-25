/**
 * Pick the chest cell: farthest dead-end from the entrance, excluding the
 * exit cell unless it is the only remaining candidate. Ties are broken by
 * (x, y) ascending for determinism.
 */
export function pickChestCell(maze) {
    const candidates = maze.deadEnds.filter((c) => !(c.x === maze.entrance.x && c.y === maze.entrance.y));
    if (candidates.length === 0) {
        return maze.exit;
    }
    const nonExit = candidates.filter((c) => !(c.x === maze.exit.x && c.y === maze.exit.y));
    const pool = nonExit.length > 0 ? nonExit : candidates;
    let best = pool[0];
    let bestDist = maze.bfsDistance(best);
    for (let i = 1; i < pool.length; i++) {
        const c = pool[i];
        const d = maze.bfsDistance(c);
        if (d > bestDist) {
            best = c;
            bestDist = d;
        }
        else if (d === bestDist) {
            if (c.x < best.x || (c.x === best.x && c.y < best.y)) {
                best = c;
            }
        }
    }
    return best;
}
/**
 * Allocate all chests for a floor per spec §7.1.1:
 *   1. Key-chest: random dead-end with BFS ≥ 50% of max (excluding exit).
 *   2. Armory chests: random dead-ends with BFS ≥ 60% of max.
 *   3. Supply chests: random from any remaining dead-ends.
 *
 * Density: total ≈ round(cells/20), minimum 3. Armory ≈ 30% of non-key chests.
 */
export function allocateChests(maze, rng) {
    const W = maze.cells.length;
    const H = maze.cells[0].length;
    const totalCells = W * H;
    const targetTotal = Math.max(3, Math.round(totalCells / 20));
    let maxDist = 0;
    for (const d of maze.deadEnds) {
        const dist = maze.bfsDistance(d);
        if (dist > maxDist)
            maxDist = dist;
    }
    const keyThreshold = maxDist * 0.5;
    const armoryThreshold = maxDist * 0.6;
    const eligible = maze.deadEnds.filter((c) => !(c.x === maze.entrance.x && c.y === maze.entrance.y) &&
        !(c.x === maze.exit.x && c.y === maze.exit.y));
    // Pick key cell: random from those meeting 50% threshold; fallback to farthest.
    const keyPool = eligible.filter((c) => maze.bfsDistance(c) >= keyThreshold);
    const keyCell = keyPool.length > 0 ? pickRandom(keyPool, rng) : pickChestCell(maze);
    const remaining = eligible.filter((c) => !(c.x === keyCell.x && c.y === keyCell.y));
    const armoryTarget = Math.max(1, Math.round((targetTotal - 1) * 0.3));
    const supplyTarget = Math.max(0, targetTotal - 1 - armoryTarget);
    // Armory: random from dead-ends meeting 60% threshold.
    const armoryPool = shuffle(remaining.filter((c) => maze.bfsDistance(c) >= armoryThreshold), rng);
    const armoryCells = armoryPool.slice(0, armoryTarget);
    // Supply: random from everything else.
    const supplyPool = shuffle(remaining.filter((c) => !armoryCells.some((a) => a.x === c.x && a.y === c.y)), rng);
    const supplyCells = supplyPool.slice(0, supplyTarget);
    return { keyCell, armoryCells, supplyCells };
}
function pickRandom(arr, rng) {
    return arr[Math.floor(rng() * arr.length)];
}
function shuffle(arr, rng) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}
export function lootTierForFloor(floorNum) {
    return floorNum <= 2 ? 1 : 2;
}
