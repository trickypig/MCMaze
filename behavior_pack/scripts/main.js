import { world, system } from "@minecraft/server";
import { loadRunState, saveRunState } from "./state/persistence";
import { RunPhase } from "./state/run";
import { handleFirstJoin, prisonSpec } from "./events/first_join";
import { handlePressurePlate } from "./events/pressure_plate";
import { registerDeathHandlers } from "./events/death";
export const runState = loadRunState();
registerDeathHandlers(runState);
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
system.runInterval(() => {
    if (runState.phase !== RunPhase.Prison)
        return;
    if (!prisonSpec)
        return;
    const plate = prisonSpec.pressurePlatePos;
    for (const p of world.getAllPlayers()) {
        const loc = p.location;
        if (Math.floor(loc.x) === plate.x &&
            Math.floor(loc.y) === plate.y &&
            Math.floor(loc.z) === plate.z) {
            handlePressurePlate(runState);
            break;
        }
    }
}, 20);
export function commitState() {
    saveRunState(runState);
}
system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id === "trickymaze:shutdown") {
        world.getDimension("overworld").runCommand("gamerule dommobspawning true");
        world.sendMessage("§7TrickyMaze shutdown: mob spawning restored.");
        console.warn("[TrickyMaze] Shutdown event received; gamerule restored.");
    }
});
