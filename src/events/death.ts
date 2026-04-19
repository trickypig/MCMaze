import { world, GameMode, Player, system } from "@minecraft/server";
import { RunPhase, type RunState } from "../state/run";
import { commitState } from "../main";
import { ANCHOR, prisonSpec } from "./first_join";
import { applyOps } from "../generation/world_writer";
import type { FillOp } from "../generation/floor";

const RESET_SECONDS = 5;
const MAX_DESCENT_FLOORS = 20;
const FLOOR_Y_GAP = 6;

export function registerDeathHandlers(state: RunState): void {
  world.afterEvents.entityDie.subscribe((ev) => {
    const entity = ev.deadEntity;
    if (!(entity instanceof Player)) return;
    if (state.phase !== RunPhase.FloorActive) return;

    console.warn(`[TrickyMaze] Player died: ${entity.name}`);
    state.markDead(entity.id);
    const lastPlayerDied = state.aliveCount() === 0;
    commitState();

    // Immediately set them to spectator (the death screen will briefly show).
    system.runTimeout(() => {
      try {
        entity.setGameMode(GameMode.Spectator);
      } catch (e) {
        console.warn(`[TrickyMaze] Failed to set spectator: ${String(e)}`);
      }
    }, 10);

    if (lastPlayerDied) {
      console.warn("[TrickyMaze] Last player died — starting reset countdown.");
      startResetCountdown(state);
    }
  });

  world.afterEvents.playerLeave?.subscribe((ev) => {
    const wasFloorActive = state.phase === RunPhase.FloorActive;
    state.markDead(ev.playerId);
    commitState();
    if (wasFloorActive && state.aliveCount() === 0) {
      startResetCountdown(state);
    }
  });
}

function startResetCountdown(state: RunState): void {
  let remaining = RESET_SECONDS;
  const id = system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      p.onScreenDisplay.setActionBar(`§cRespawning in ${remaining}…`);
    }
    remaining--;
    if (remaining < 0) {
      system.clearRun(id);
      performReset(state);
    }
  }, 20);
}

function performReset(state: RunState): void {
  console.warn("[TrickyMaze] Performing reset.");

  // Demolish all possible floor volumes back to air.
  const ops: FillOp[] = [];
  for (let n = 1; n <= MAX_DESCENT_FLOORS; n++) {
    ops.push({
      min: {
        x: ANCHOR.x - 5,
        y: ANCHOR.y - FLOOR_Y_GAP * n - 1,
        z: ANCHOR.z - 5,
      },
      max: {
        x: ANCHOR.x + 125,
        y: ANCHOR.y - FLOOR_Y_GAP * n + 5,
        z: ANCHOR.z + 125,
      },
      block: "minecraft:air",
    });
  }
  applyOps(ops);

  state.reset();
  commitState();

  if (!prisonSpec) return;

  for (const p of world.getAllPlayers()) {
    p.setGameMode(GameMode.Adventure);
    p.teleport(prisonSpec.spawnPos, {
      dimension: world.getDimension("overworld"),
    });
    const inv = p.getComponent("minecraft:inventory")?.container;
    inv?.clearAll();
    p.runCommand("give @s bread 8");
    state.markAlive(p.id);
  }
  commitState();
  world.sendMessage("§7You wake up in the prison. The dungeon resets.");
}
