import { world, system } from "@minecraft/server";
import { loadRunState, saveRunState } from "./state/persistence";
import { RunPhase } from "./state/run";
import { handleFirstJoin } from "./events/first_join";
export const runState = loadRunState();
system.run(() => {
    console.warn(`[TrickyMaze] Initialized. phase=${runState.phase} floor=${runState.floor}`);
});
world.afterEvents.playerSpawn.subscribe((ev) => {
    if (!ev.initialSpawn)
        return;
    if (runState.phase === RunPhase.Idle) {
        handleFirstJoin(runState);
    }
    else {
        console.warn(`[TrickyMaze] Mid-run join by ${ev.player.name} — not handled in Plan 1.`);
    }
});
export function commitState() {
    saveRunState(runState);
}
