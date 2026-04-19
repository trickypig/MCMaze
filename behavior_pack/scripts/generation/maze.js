const DX = { N: 0, S: 0, E: 1, W: -1 };
const DY = { N: -1, S: 1, E: 0, W: 0 };
const OPPOSITE = {
    N: "S",
    S: "N",
    E: "W",
    W: "E",
};
/**
 * Recursive-backtracking maze. Width/height are in cells (not blocks).
 * rng() must return a float in [0, 1).
 */
export function generateMaze(width, height, rng) {
    if (width < 2 || height < 2) {
        throw new Error("Maze requires width >= 2 and height >= 2");
    }
    const cells = [];
    for (let x = 0; x < width; x++) {
        const col = [];
        for (let y = 0; y < height; y++) {
            col.push({ walls: { N: true, S: true, E: true, W: true } });
        }
        cells.push(col);
    }
    const visited = Array.from({ length: width }, () => Array(height).fill(false));
    const stack = [{ x: 0, y: 0 }];
    visited[0][0] = true;
    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const neighbors = ["N", "S", "E", "W"].filter((d) => {
            const nx = current.x + DX[d];
            const ny = current.y + DY[d];
            return (nx >= 0 &&
                ny >= 0 &&
                nx < width &&
                ny < height &&
                !visited[nx][ny]);
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
    const entrance = { x: 0, y: 0 };
    const { distances, furthest } = bfs(cells, entrance);
    const exit = furthest;
    const deadEnds = findDeadEnds(cells);
    const bfsDistance = (cell) => distances[cell.x][cell.y];
    return { cells, entrance, exit, deadEnds, bfsDistance };
}
function bfs(cells, start) {
    const width = cells.length;
    const height = cells[0].length;
    const distances = Array.from({ length: width }, () => Array(height).fill(-1));
    distances[start.x][start.y] = 0;
    const queue = [start];
    let furthest = start;
    let furthestDist = 0;
    while (queue.length > 0) {
        const c = queue.shift();
        const d = distances[c.x][c.y];
        for (const dir of ["N", "S", "E", "W"]) {
            if (cells[c.x][c.y].walls[dir])
                continue;
            const nx = c.x + DX[dir];
            const ny = c.y + DY[dir];
            if (distances[nx][ny] !== -1)
                continue;
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
function findDeadEnds(cells) {
    const out = [];
    for (let x = 0; x < cells.length; x++) {
        for (let y = 0; y < cells[0].length; y++) {
            const w = cells[x][y].walls;
            const openCount = (w.N ? 0 : 1) + (w.S ? 0 : 1) + (w.E ? 0 : 1) + (w.W ? 0 : 1);
            if (openCount === 1 && !(x === 0 && y === 0)) {
                out.push({ x, y });
            }
        }
    }
    return out;
}
