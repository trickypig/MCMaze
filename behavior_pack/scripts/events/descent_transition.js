import { world, system, GameMode } from "@minecraft/server";
import { activeFloor, buildAndEnterFloor, setActiveFloor, FLOOR_DEPTH } from "./pressure_plate";
import { ANCHOR } from "./first_join";
import { commitState } from "../main";
const CHUNK_WAIT_TICKS = 10;
const CHUNK_WAIT_MAX_ATTEMPTS = 30;
const MAX_FLOOR = 4;
/**
 * Execute the transition step of the descent cinematic.
 *  - Tear down current floor's ticking area
 *  - Branch: floor 4 → victory
 *  - Otherwise: advance anchor, add ticking area, poll for chunk load, build next floor
 *  - After build: teleport all alive players + restore spectators to survival + teleport
 *  - Call `done()` when the transition is complete (success or failure).
 */
export function runDescentTransition(state, done) {
    if (!activeFloor) {
        done();
        return;
    }
    const dim = world.getDimension("overworld");
    const leavingFloor = activeFloor.floor;
    // Tear down the current floor's ticking area.
    try {
        dim.runCommand(`tickingarea remove ${activeFloor.tickingAreaName}`);
    }
    catch { /* ignore */ }
    state.trackedTickingAreas = state.trackedTickingAreas.filter((n) => n !== activeFloor.tickingAreaName);
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
    }
    catch { /* ignore */ }
    dim.runCommand(`tickingarea add ${nextAnchor.x - 5} ${nextAnchor.y - 5} ${nextAnchor.z - 5} ` +
        `${nextAnchor.x + 125} ${nextAnchor.y + 10} ${nextAnchor.z + 125} ` +
        `${nextTickingAreaName} true`);
    state.trackTickingArea(nextTickingAreaName);
    whenChunksLoaded(nextAnchor, (ok) => {
        if (!ok) {
            console.warn("[TrickyMaze] Descent transition aborted — new floor chunks never loaded.");
            try {
                dim.runCommand(`tickingarea remove ${nextTickingAreaName}`);
            }
            catch { /* ignore */ }
            state.trackedTickingAreas = state.trackedTickingAreas.filter((n) => n !== nextTickingAreaName);
            done();
            return;
        }
        // Remove the pre-added area — buildAndEnterFloor will re-add it with the
        // final bounds. Otherwise we'd have two tickingareas with the same name.
        try {
            dim.runCommand(`tickingarea remove ${nextTickingAreaName}`);
        }
        catch { /* ignore */ }
        state.trackedTickingAreas = state.trackedTickingAreas.filter((n) => n !== nextTickingAreaName);
        buildAndEnterFloor(state, nextFloor);
        // Restore dead players to the new floor start.
        // buildAndEnterFloor already teleports alive players to the entrance.
        // Dead players are not handled there, so we restore them here.
        // cell (0,0) center — matches buildAndEnterFloor's entranceBlock since maze.entrance is always (0,0)
        const spec = activeFloor;
        if (!spec) {
            done();
            return;
        }
        const startPos = {
            x: spec.anchor.x + 2.5,
            y: spec.anchor.y + 1,
            z: spec.anchor.z + 2.5,
        };
        const wasDead = state.deadIds();
        for (const id of wasDead) {
            const p = findPlayerById(id);
            if (!p)
                continue;
            p.setGameMode(GameMode.Adventure);
            p.teleport(startPos, { dimension: dim });
        }
        state.clearDead();
        done();
    });
}
/**
 * Victory branch: floor 4 cleared. Show Run Complete, play sounds, reset to Idle.
 */
function runVictory(state) {
    const dim = world.getDimension("overworld");
    for (const p of world.getAllPlayers()) {
        p.onScreenDisplay.setTitle("§6§lRun Complete!", {
            subtitle: "§eYou escaped the maze.",
            fadeInDuration: 10,
            stayDuration: 80,
            fadeOutDuration: 10,
        });
        try {
            p.playSound("random.levelup", { volume: 1, pitch: 1 });
        }
        catch { /* ignore */ }
        try {
            p.playSound("ui.toast.challenge_complete", { volume: 1, pitch: 1 });
        }
        catch { /* ignore */ }
        if (state.isDead(p.id)) {
            p.setGameMode(GameMode.Adventure);
        }
    }
    // Tear down every tracked ticking area.
    for (const name of state.trackedTickingAreas) {
        try {
            dim.runCommand(`tickingarea remove ${name}`);
        }
        catch { /* ignore */ }
    }
    state.resetToIdle();
    setActiveFloor(null);
    commitState();
}
function whenChunksLoaded(pos, done) {
    const dim = world.getDimension("overworld");
    let attempts = 0;
    const tick = () => {
        attempts++;
        let ready = false;
        try {
            ready = dim.getBlock(pos) !== undefined;
        }
        catch {
            ready = false;
        }
        if (ready) {
            done(true);
            return;
        }
        if (attempts >= CHUNK_WAIT_MAX_ATTEMPTS) {
            done(false);
            return;
        }
        system.runTimeout(tick, CHUNK_WAIT_TICKS);
    };
    system.runTimeout(tick, CHUNK_WAIT_TICKS);
}
function findPlayerById(id) {
    for (const p of world.getAllPlayers()) {
        if (p.id === id)
            return p;
    }
    return undefined;
}
