import { world, GameMode, Player, system } from "@minecraft/server";
import { RunPhase } from "../state/run";
import { commitState } from "../main";
import { activeFloor } from "./pressure_plate";
import { getPrisonSpec } from "./first_join";
export function registerDeathHandlers(state) {
    world.afterEvents.entityDie.subscribe((ev) => {
        const entity = ev.deadEntity;
        if (!(entity instanceof Player))
            return;
        if (state.phase !== RunPhase.FloorActive && state.phase !== RunPhase.Prison)
            return;
        console.warn(`[TrickyMaze] Player died: ${entity.name}`);
        state.markDead(entity.id);
        commitState();
        // Set spectator after the death screen clears.
        system.runTimeout(() => {
            try {
                entity.setGameMode(GameMode.Spectator);
                teleportDeadPlayerToOverview(entity);
            }
            catch (e) {
                console.warn(`[TrickyMaze] Failed to set spectator: ${String(e)}`);
            }
        }, 10);
        if (state.aliveCount() === 0) {
            triggerGameOver(state);
        }
    });
    world.afterEvents.playerLeave?.subscribe((ev) => {
        if (state.phase !== RunPhase.FloorActive && state.phase !== RunPhase.Prison)
            return;
        state.markDead(ev.playerId);
        commitState();
        if (state.aliveCount() === 0) {
            triggerGameOver(state);
        }
    });
    world.afterEvents.playerSpawn.subscribe((ev) => {
        // Rehydrate spectator state on respawn (Bedrock resets gamemode across reloads).
        const p = ev.player;
        if (state.phase !== RunPhase.FloorActive && state.phase !== RunPhase.Prison)
            return;
        if (!state.isDead(p.id))
            return;
        system.runTimeout(() => {
            try {
                p.setGameMode(GameMode.Spectator);
                teleportDeadPlayerToOverview(p);
            }
            catch { /* ignore */ }
        }, 5);
    });
}
function teleportDeadPlayerToOverview(p) {
    const dim = world.getDimension("overworld");
    if (activeFloor) {
        const a = activeFloor.anchor;
        // Hover roughly over the maze center, a few blocks above the ceiling.
        const center = {
            x: a.x + activeFloor.size * 1.5,
            y: a.y + 15,
            z: a.z + activeFloor.size * 1.5,
        };
        p.teleport(center, { dimension: dim });
        return;
    }
    const spec = getPrisonSpec();
    if (spec) {
        p.teleport({ x: spec.spawnPos.x, y: spec.spawnPos.y + 5, z: spec.spawnPos.z }, { dimension: dim });
    }
}
function triggerGameOver(state) {
    console.warn(`[TrickyMaze] All players dead — GameOver at floor ${state.currentFloor}`);
    state.triggerGameOver();
    commitState();
    for (const p of world.getAllPlayers()) {
        p.onScreenDisplay.setTitle("§4Run Failed", {
            subtitle: `§7Floor ${state.currentFloor} • All heroes fell`,
            fadeInDuration: 10,
            stayDuration: 120,
            fadeOutDuration: 10,
        });
    }
    world.sendMessage("§7Use /scriptevent trickymaze:restart to begin a new run.");
}
