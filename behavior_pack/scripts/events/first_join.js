import { world, GameMode, system } from "@minecraft/server";
import { buildPrison } from "../generation/prison";
import { applyOps } from "../generation/world_writer";
import { RunPhase } from "../state/run";
import { commitState } from "../main";
export const ANCHOR = { x: 10000, y: -50, z: 10000 };
const TICKING_AREA_NAME = "trickymaze_anchor";
const FLOOR_Y_SPAN = 150; // Covers prison + ~20 stacked floors.
export let prisonSpec = null;
export function handleFirstJoin(state) {
    if (state.phase !== RunPhase.Idle)
        return;
    console.warn("[TrickyMaze] First join detected — building prison.");
    const dim = world.getDimension("overworld");
    // Force-load the anchor region (§4.6 chunk loading) so fillBlocks and
    // teleports don't race against chunk unload. `remove` may fail the first
    // time through (nothing to remove) — that's fine.
    try {
        dim.runCommand(`tickingarea remove ${TICKING_AREA_NAME}`);
    }
    catch {
        /* no existing area — ignore */
    }
    dim.runCommand(`tickingarea add ${ANCHOR.x - 10} ${ANCHOR.y - FLOOR_Y_SPAN} ${ANCHOR.z - 10} ` +
        `${ANCHOR.x + 140} ${ANCHOR.y + 10} ${ANCHOR.z + 140} ${TICKING_AREA_NAME} true`);
    const prison = buildPrison(ANCHOR);
    prisonSpec = prison;
    applyOps(prison.operations);
    state.enterPrison();
    commitState();
    // Disable natural mob spawning world-wide for this session (§9.1).
    dim.runCommand("gamerule dommobspawning false");
    // Teleport all connected players into the prison, adventure mode, give bread.
    system.runTimeout(() => {
        for (const p of world.getAllPlayers()) {
            p.teleport(prison.spawnPos, { dimension: dim });
            p.setGameMode(GameMode.Adventure);
            const inv = p.getComponent("minecraft:inventory")?.container;
            inv?.clearAll();
            p.runCommand("give @s bread 8");
            state.markAlive(p.id);
        }
        commitState();
    }, 20); // 1-second delay so the world is loaded when we teleport.
}
