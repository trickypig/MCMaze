import { world } from "@minecraft/server";
import { RunState, RunPhase } from "./run";
const KEY = "trickymaze:run";
export function loadRunState() {
    const raw = world.getDynamicProperty(KEY);
    if (typeof raw !== "string") {
        return new RunState();
    }
    try {
        const blob = JSON.parse(raw);
        const state = RunState.hydrate(blob);
        // Reload-mid-cinematic recovery: Descending is transient; on reload we
        // can't resume the cinematic, so roll back to FloorActive. Players
        // replay the exit plate to retrigger descent.
        if (state.phase === RunPhase.Descending) {
            state.finishDescent();
            console.warn("[TrickyMaze] Reload mid-descent — phase reset to FloorActive.");
        }
        return state;
    }
    catch {
        console.warn("[TrickyMaze] Failed to parse RunState — starting fresh.");
        return new RunState();
    }
}
export function saveRunState(state) {
    world.setDynamicProperty(KEY, JSON.stringify(state.serialize()));
}
export { RunPhase };
