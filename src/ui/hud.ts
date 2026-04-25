import { system, world, type Player } from "@minecraft/server";
import { RunPhase, type RunState } from "../state/run";
import { KEY_ITEM_TYPE } from "../generation/key_item";

const HUD_INTERVAL_TICKS = 20; // 1 Hz

function playerHasKey(p: Player): boolean {
  const inv = p.getComponent("minecraft:inventory")?.container;
  if (!inv) return false;
  for (let i = 0; i < inv.size; i++) {
    const stack = inv.getItem(i);
    if (stack && stack.typeId === KEY_ITEM_TYPE) return true;
  }
  return false;
}

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

    for (const p of world.getAllPlayers()) {
      if (!state.isAlive(p.id)) continue;
      const keyLabel = playerHasKey(p) ? "§aFOUND" : "not found";
      const msg = `§eFloor ${state.floor}§r · §bKey:§r ${keyLabel}§r · §cMobs:§r ${mobCount}`;
      try { p.onScreenDisplay.setActionBar(msg); } catch { /* ignore */ }
    }
  }, HUD_INTERVAL_TICKS);
}
