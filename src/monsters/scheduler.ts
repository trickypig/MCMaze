import { system, world } from "@minecraft/server";
import { getBehavior } from "./registry";
import { clearRuntime } from "./state";

const TICK_INTERVAL = 4; // 4 game ticks = 5 Hz

let started = false;

export function startMonsterScheduler(): void {
  if (started) return;
  started = true;

  system.runInterval(tickAll, TICK_INTERVAL);

  world.afterEvents.entityDie.subscribe((ev) => {
    try { clearRuntime(ev.deadEntity.id); } catch { /* ignore */ }
  });
  world.afterEvents.entityRemove.subscribe((ev) => {
    try { clearRuntime(ev.removedEntityId); } catch { /* ignore */ }
  });
}

function tickAll(): void {
  const dim = world.getDimension("overworld");
  let entities;
  try {
    entities = dim.getEntities({ families: ["trickymaze"] });
  } catch (e) {
    console.warn(`[TrickyMaze] monster scan failed: ${String(e)}`);
    return;
  }

  for (const e of entities) {
    let behavior: string | undefined;
    try {
      behavior = e.getDynamicProperty("trickymaze:behavior") as
        | string
        | undefined;
    } catch {
      continue;
    }
    if (!behavior) continue;

    const fn = getBehavior(behavior);
    if (!fn) continue;

    try {
      fn(e);
    } catch (err) {
      console.warn(
        `[TrickyMaze] tick '${behavior}' on ${e.id} threw: ${String(err)}`,
      );
    }
  }
}

export function monsterTickIntervalTicks(): number {
  return TICK_INTERVAL;
}
