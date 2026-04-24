import { system, world } from "@minecraft/server";
import { RunPhase, type RunState } from "../state/run";

const HUD_INTERVAL_TICKS = 20; // 1 Hz

export function startHud(state: RunState): void {
  system.runInterval(() => {
    if (state.phase !== RunPhase.FloorActive) return;

    const dim = world.getDimension("overworld");
    let mobCount = 0;
    try {
      mobCount = dim.getEntities({ families: ["trickymaze"] }).length;
    } catch {
      mobCount = 0;
    }

    const keyLabel = "not found"; // Plan 3 will flip to "FOUND" on pickup.
    const msg = `§eFloor ${state.floor}§r · §bKey:§r ${keyLabel} · §cMobs:§r ${mobCount}`;

    for (const p of world.getAllPlayers()) {
      if (!state.isAlive(p.id)) continue;
      try { p.onScreenDisplay.setActionBar(msg); } catch { /* ignore */ }
    }
  }, HUD_INTERVAL_TICKS);
}
