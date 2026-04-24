import { world, system } from "@minecraft/server";
import { loadRunState, saveRunState } from "./state/persistence";
import { RunPhase } from "./state/run";
import { handleFirstJoin, prisonSpec } from "./events/first_join";
import { handlePressurePlate, setActiveFloor } from "./events/pressure_plate";
import { registerDeathHandlers } from "./events/death";
import { registerExitPlatePoll } from "./events/exit_plate";
// Hydrated on the first system tick — world.getDynamicProperty is forbidden
// during early execution, so top-level calls crash with a ReferenceError.
export let runState;
export function commitState() {
    saveRunState(runState);
}
system.run(() => {
    runState = loadRunState();
    registerDeathHandlers(runState);
    registerExitPlatePoll(runState);
    console.warn(`[TrickyMaze v1.1] Initialized. phase=${runState.phase} floor=${runState.floor} ` +
        `currentFloor=${runState.currentFloor} tickingAreas=[${runState.trackedTickingAreas.join(",")}]`);
    world.afterEvents.playerSpawn.subscribe((ev) => {
        const phase = runState.phase;
        if (phase === RunPhase.Idle) {
            // Rebuild prison on any spawn in Idle — covers first-ever join, post-restart, and post-victory.
            // handleFirstJoin is idempotent if prisonSpec is already set (it early-returns
            // when phase is not Idle after entering Prison).
            handleFirstJoin(runState);
            return;
        }
        if (phase === RunPhase.GameOver) {
            // Dead screen visible — don't rebuild, don't restore. Wait for restart scriptevent.
            return;
        }
        if (phase === RunPhase.Prison || phase === RunPhase.FloorActive) {
            if (!runState.isAlive(ev.player.id) && !runState.isDead(ev.player.id)) {
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
        return;
    }
    if (ev.id === "trickymaze:restart") {
        if (runState.phase !== RunPhase.GameOver) {
            console.warn(`[TrickyMaze] restart ignored — phase is ${runState.phase}`);
            world.sendMessage("§cRestart can only be used after a Run Failed screen.");
            return;
        }
        handleRestart();
    }
});
function handleRestart() {
    console.warn("[TrickyMaze] Restart scriptevent — resetting run.");
    const dim = world.getDimension("overworld");
    for (const name of runState.trackedTickingAreas) {
        try {
            dim.runCommand(`tickingarea remove ${name}`);
        }
        catch { /* ignore */ }
    }
    setActiveFloor(null);
    runState.resetToIdle();
    commitState();
    world.sendMessage("§aRun reset. Respawn or relog to begin a new run.");
}
