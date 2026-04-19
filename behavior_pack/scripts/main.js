import { world, system } from "@minecraft/server";
import { loadRunState, saveRunState } from "./state/persistence";
import { RunPhase } from "./state/run";
import { handleFirstJoin, prisonSpec } from "./events/first_join";
import { handlePressurePlate } from "./events/pressure_plate";
import { registerDeathHandlers } from "./events/death";
// Hydrated on the first system tick — world.getDynamicProperty is forbidden
// during early execution, so top-level calls crash with a ReferenceError.
export let runState;
export function commitState() {
    saveRunState(runState);
}
system.run(() => {
    runState = loadRunState();
    registerDeathHandlers(runState);
    console.warn(`[TrickyMaze] Initialized. phase=${runState.phase} floor=${runState.floor}`);
    world.afterEvents.playerSpawn.subscribe((ev) => {
        const phase = runState.phase;
        if (phase === RunPhase.Idle) {
            if (ev.initialSpawn)
                handleFirstJoin(runState);
            return;
        }
        // Reload/respawn/late-join: restore membership in the alive set so the
        // player counts for death-gate + teleport checks. `alive` is not
        // persisted (by design — keeps the blob tiny) so it must be rebuilt
        // from whoever's actually in the world.
        if (phase === RunPhase.Prison || phase === RunPhase.FloorActive) {
            if (!runState.isAlive(ev.player.id)) {
                runState.markAlive(ev.player.id);
                commitState();
            }
            if (!ev.initialSpawn)
                return;
            console.warn(`[TrickyMaze] Mid-run join by ${ev.player.name} — tolerated, not teleported.`);
        }
    });
    // One-shot rehydration for players already connected at script init
    // (world reload case — playerSpawn may not re-fire for them).
    if (runState.phase === RunPhase.Prison || runState.phase === RunPhase.FloorActive) {
        for (const p of world.getAllPlayers()) {
            runState.markAlive(p.id);
        }
        commitState();
    }
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
});
system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id === "trickymaze:shutdown") {
        world.getDimension("overworld").runCommand("gamerule domobspawning true");
        world.sendMessage("§7TrickyMaze shutdown: mob spawning restored.");
        console.warn("[TrickyMaze] Shutdown event received; gamerule restored.");
    }
});
