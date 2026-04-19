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
        return RunState.hydrate(blob);
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
