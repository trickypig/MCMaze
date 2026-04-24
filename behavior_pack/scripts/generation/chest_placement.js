/**
 * Pick the chest cell: farthest dead-end from the entrance, excluding the
 * exit cell unless it is the only remaining candidate. Ties are broken by
 * (x, y) ascending for determinism.
 */
export function pickChestCell(maze) {
    const candidates = maze.deadEnds.filter((c) => !(c.x === maze.entrance.x && c.y === maze.entrance.y));
    if (candidates.length === 0) {
        // Empty fallback — shouldn't happen for width/height >= 2, but guard.
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
