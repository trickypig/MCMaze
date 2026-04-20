import { world, system, Player, InputPermissionCategory } from "@minecraft/server";
import { RunPhase, type RunState } from "../state/run";
import { activeFloor } from "./pressure_plate";
import { runDescentTransition } from "./descent_transition";
import { commitState } from "../main";

let descentInFlight = false;

export function isDescentInFlight(): boolean {
  return descentInFlight;
}

/**
 * Kick off the 4-second cinematic. Callers (exit-plate poll) must have
 * already consumed the key and opened the door. This sets Descending phase,
 * schedules all cinematic beats, and hands off to the transition at t=70.
 */
export function beginDescent(state: RunState): void {
  if (descentInFlight) return;
  if (!activeFloor) return;
  descentInFlight = true;

  state.beginDescent();
  commitState();

  const dim = world.getDimension("overworld");
  const currentFloor = activeFloor.floor;
  const alivePlayers = [...world.getAllPlayers()].filter((p) => state.isAlive(p.id));

  // t=0: freeze alive players + start thunder.
  for (const p of alivePlayers) freezePlayer(p);
  try {
    dim.runCommand("weather thunder 200");
  } catch {
    /* weather command can fail on worlds with gamerule doweathercycle false — ignore */
  }

  // t=4: title.
  system.runTimeout(() => {
    for (const p of alivePlayers) {
      p.onScreenDisplay.setTitle("§6Descending…", {
        subtitle: `§7Floor ${currentFloor + 1}`,
        fadeInDuration: 4,
        stayDuration: 60,
        fadeOutDuration: 4,
      });
    }
  }, 4);

  // t=10: ambient cave.
  system.runTimeout(() => {
    for (const p of alivePlayers) {
      try {
        p.playSound("ambient.cave", { volume: 1, pitch: 0.5 });
      } catch { /* unknown sound — ignore */ }
    }
  }, 10);

  // t=30: wither rumble.
  system.runTimeout(() => {
    for (const p of alivePlayers) {
      try {
        p.playSound("mob.wither.spawn", { volume: 0.7, pitch: 0.7 });
      } catch { /* ignore */ }
    }
  }, 30);

  // t=60: black-curtain title.
  system.runTimeout(() => {
    for (const p of alivePlayers) {
      p.onScreenDisplay.setTitle("§0 ", {
        subtitle: "§0 ",
        fadeInDuration: 10,
        stayDuration: 20,
        fadeOutDuration: 10,
      });
    }
  }, 60);

  // t=70: transition.
  system.runTimeout(() => {
    runDescentTransition(state, () => {
      // Completion callback — runs after transition resolves.
      system.runTimeout(() => {
        try { dim.runCommand("weather clear"); } catch { /* ignore */ }
        descentInFlight = false;
        state.finishDescent();
        commitState();
        for (const p of [...world.getAllPlayers()].filter((p) => state.isAlive(p.id))) {
          unfreezePlayer(p);
        }
      }, 10); // t=80 relative to cinematic start
    });
  }, 70);
}

function freezePlayer(player: Player): void {
  try {
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, false);
  } catch { /* API missing on older clients — fall through */ }
}

function unfreezePlayer(player: Player): void {
  try {
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);
  } catch { /* ignore */ }
}

/**
 * Emergency reset used by the chunk-load-failure path and the restart
 * scriptevent — clear the in-flight flag and unfreeze everyone.
 */
export function abortDescent(state: RunState): void {
  descentInFlight = false;
  for (const p of world.getAllPlayers()) unfreezePlayer(p);
  try {
    world.getDimension("overworld").runCommand("weather clear");
  } catch { /* ignore */ }
  if (state.phase === RunPhase.Descending) state.finishDescent();
}
