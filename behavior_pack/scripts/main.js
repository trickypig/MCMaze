import { world, system } from "@minecraft/server";
import { loadRunState, saveRunState } from "./state/persistence";
export const runState = loadRunState();
system.run(() => {
    console.warn(`[TrickyMaze] Initialized. phase=${runState.phase} floor=${runState.floor}`);
});
// Placeholder: subsequent tasks hook events here.
world.afterEvents.playerSpawn.subscribe((ev) => {
    console.warn(`[TrickyMaze] playerSpawn: ${ev.player.name} (init=${ev.initialSpawn})`);
});
// Persist on any state change — convenience helper.
export function commitState() {
    saveRunState(runState);
}
