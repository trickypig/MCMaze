import { world, GameMode, system } from "@minecraft/server";
import type { Vec3 } from "../generation/floor";
import { buildPrison, type PrisonSpec } from "../generation/prison";
import { applyOps } from "../generation/world_writer";
import { RunPhase, RunState } from "../state/run";
import { commitState } from "../main";

export const ANCHOR: Vec3 = { x: 10000, y: 0, z: 10000 };
const TICKING_AREA_NAME = "trickymaze_anchor";
const FLOOR_Y_SPAN = 50; // Covers prison + 4 floors at FLOOR_DEPTH=10 with headroom.
const WORLD_MIN_Y = -60;
const CHUNK_WAIT_TICKS = 5;
const CHUNK_WAIT_MAX_ATTEMPTS = 120; // ~30 seconds at 5-tick poll.

export let prisonSpec: PrisonSpec | null = null;

/**
 * Callable accessor — some script runtimes snapshot module-level bindings at
 * import time instead of re-reading them, so callers that check `prisonSpec`
 * periodically should go through this.
 */
export function getPrisonSpec(): PrisonSpec | null {
  return prisonSpec;
}

/**
 * Recompute prisonSpec without rebuilding the room. Used on script reload
 * when the world is already in Prison phase — the blocks still exist but
 * the module-level spec was lost.
 */
export function rehydratePrisonSpec(): void {
  prisonSpec = buildPrison(ANCHOR);
}

export function handleFirstJoin(state: RunState): void {
  if (state.phase !== RunPhase.Idle) return;

  console.warn("[TrickyMaze] First join detected — building prison.");

  const dim = world.getDimension("overworld");

  // Force-load the anchor region (§4.6 chunk loading). `remove` may fail the
  // first time through (nothing to remove) — that's fine.
  try {
    dim.runCommand(`tickingarea remove ${TICKING_AREA_NAME}`);
  } catch {
    /* no existing area — ignore */
  }
  const minY = Math.max(WORLD_MIN_Y, ANCHOR.y - FLOOR_Y_SPAN);
  try {
    dim.runCommand(
      `tickingarea add ${ANCHOR.x - 10} ${minY} ${ANCHOR.z - 10} ` +
        `${ANCHOR.x + 140} ${ANCHOR.y + 10} ${ANCHOR.z + 140} ${TICKING_AREA_NAME} true`,
    );
    console.warn(
      `[TrickyMaze] tickingarea added: (${ANCHOR.x - 10},${minY},${ANCHOR.z - 10}) -> (${ANCHOR.x + 140},${ANCHOR.y + 10},${ANCHOR.z + 140})`,
    );
  } catch (e) {
    console.warn(`[TrickyMaze] tickingarea add failed: ${String(e)}`);
  }
  state.trackTickingArea(TICKING_AREA_NAME);

  // Disable natural mob spawning world-wide for this session (§9.1).
  dim.runCommand("gamerule domobspawning false");

  // tickingarea schedules chunk loading asynchronously; fillBlocks throws
  // UnloadedChunksError if we don't wait. Poll until the anchor block is
  // readable, then build and teleport.
  whenChunksLoaded(ANCHOR, () => {
    console.warn("[TrickyMaze] Chunks loaded — building prison.");
    const prison = buildPrison(ANCHOR);
    prisonSpec = prison;
    applyOps(prison.operations);
    state.enterPrison();
    commitState();
    console.warn(
      `[TrickyMaze] Prison built. plate at (${prison.pressurePlatePos.x},${prison.pressurePlatePos.y},${prison.pressurePlatePos.z}) spawn at (${prison.spawnPos.x},${prison.spawnPos.y},${prison.spawnPos.z})`,
    );

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
    }, 10);
  });
}

function whenChunksLoaded(pos: Vec3, done: () => void): void {
  const dim = world.getDimension("overworld");
  let attempts = 0;
  const tick = (): void => {
    attempts++;
    let ready = false;
    try {
      ready = dim.getBlock(pos) !== undefined;
    } catch {
      ready = false;
    }
    if (ready) {
      done();
      return;
    }
    if (attempts >= CHUNK_WAIT_MAX_ATTEMPTS) {
      console.warn("[TrickyMaze] Chunks never loaded at anchor — aborting build.");
      return;
    }
    system.runTimeout(tick, CHUNK_WAIT_TICKS);
  };
  system.runTimeout(tick, CHUNK_WAIT_TICKS);
}
