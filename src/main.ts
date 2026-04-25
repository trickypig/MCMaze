import { world, system, GameMode, Player } from "@minecraft/server";
import { loadRunState, saveRunState } from "./state/persistence";
import { RunPhase, RunState } from "./state/run";
import { handleFirstJoin, getPrisonSpec, rehydratePrisonSpec } from "./events/first_join";
import { handlePressurePlate, setActiveFloor, getActiveFloor, rehydrateActiveFloor } from "./events/pressure_plate";
import { registerDeathHandlers } from "./events/death";
import { registerExitPlateHandler } from "./events/exit_plate";
import { initMonsters } from "./monsters/index";
import { startHud } from "./ui/hud";

// Hydrated on the first system tick — world.getDynamicProperty is forbidden
// during early execution, so top-level calls crash with a ReferenceError.
export let runState!: RunState;

export function commitState(): void {
  saveRunState(runState);
}

system.run(() => {
  runState = loadRunState();
  registerDeathHandlers(runState);
  registerExitPlateHandler(runState);
  initMonsters();
  startHud(runState);
  console.warn(
    `[TrickyMaze v1.2] Initialized. phase=${runState.phase} floor=${runState.floor} ` +
      `currentFloor=${runState.currentFloor} tickingAreas=[${runState.trackedTickingAreas.join(",")}]`,
  );

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
      // Player hit Respawn after Run Failed — reset the run and rebuild the prison.
      handleRestart();
      return;
    }
    if (phase === RunPhase.Prison || phase === RunPhase.FloorActive) {
      const wasKnown = runState.isAlive(ev.player.id) || runState.isDead(ev.player.id);
      if (!wasKnown) {
        runState.markAlive(ev.player.id);
        commitState();
      }
      if (!ev.initialSpawn || wasKnown) return;
      teleportMidRunJoiner(ev.player);
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

  // Script-reload recovery: prisonSpec is module-local and vanishes on reload.
  // Without this the prison plate poll sees prisonSpec=null and does nothing.
  if (runState.phase === RunPhase.Prison) {
    rehydratePrisonSpec();
  }
  if (runState.phase === RunPhase.FloorActive && runState.floor > 0) {
    rehydrateActiveFloor(runState.floor);
    console.warn(`[TrickyMaze] Rehydrated activeFloor for floor ${runState.floor}.`);
  }

  world.afterEvents.pressurePlatePush.subscribe((ev) => {
    if (runState.phase !== RunPhase.Prison) return;
    const spec = getPrisonSpec();
    if (!spec) return;
    const loc = ev.block.location;
    const plate = spec.pressurePlatePos;
    if (loc.x !== plate.x || loc.y !== plate.y || loc.z !== plate.z) return;
    const src = ev.source;
    const who = src instanceof Player ? src.name : "entity";
    console.warn(`[TrickyMaze] Prison plate pushed by ${who}`);
    handlePressurePlate(runState);
  });
});

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id === "trickymaze:shutdown") {
    world.getDimension("overworld").runCommand("gamerule domobspawning true");
    world.sendMessage("§7TrickyMaze shutdown: mob spawning restored.");
    console.warn("[TrickyMaze] Shutdown event received; gamerule restored.");
    return;
  }
  if (ev.id === "trickymaze:restart") {
    handleRestart();
    return;
  }
  if (ev.id === "trickymaze:smoke_monsters") {
    runSmokeMonsters();
    return;
  }
});

function teleportMidRunJoiner(player: import("@minecraft/server").Player): void {
  const dim = world.getDimension("overworld");
  const af = getActiveFloor();
  if (runState.phase === RunPhase.FloorActive && af) {
    // Entrance is always cell (0,0); center = anchor + (2, 1, 2).
    const a = af.anchor;
    player.teleport(
      { x: a.x + 2.5, y: a.y + 1, z: a.z + 2.5 },
      { dimension: dim },
    );
    player.setGameMode(GameMode.Adventure);
    console.warn(`[TrickyMaze] Mid-run joiner ${player.name} dropped at floor ${af.floor} entrance.`);
    world.sendMessage(`§e${player.name} joined at floor ${af.floor}.`);
    return;
  }
  const spec = getPrisonSpec();
  if (runState.phase === RunPhase.Prison && spec) {
    player.teleport(spec.spawnPos, { dimension: dim });
    player.setGameMode(GameMode.Adventure);
    console.warn(`[TrickyMaze] Mid-run joiner ${player.name} dropped in prison.`);
    world.sendMessage(`§e${player.name} joined in the prison.`);
  }
}

function handleRestart(): void {
  console.warn(`[TrickyMaze] Restart — resetting run from phase=${runState.phase}`);
  const dim = world.getDimension("overworld");
  for (const name of runState.trackedTickingAreas) {
    try { dim.runCommand(`tickingarea remove ${name}`); } catch { /* ignore */ }
  }
  // Respawn spectators to Adventure so handleFirstJoin can teleport them cleanly.
  for (const p of world.getAllPlayers()) {
    try { p.setGameMode(GameMode.Adventure); } catch { /* ignore */ }
  }
  setActiveFloor(null);
  runState.resetToIdle();
  commitState();
  world.sendMessage("§aRun reset. Building a new prison…");
  handleFirstJoin(runState);
}

function runSmokeMonsters(): void {
  const dim = world.getDimension("overworld");
  const origin = world.getAllPlayers()[0]?.location;
  if (!origin) {
    console.warn("[TrickyMaze] smoke: no players in world.");
    return;
  }
  const pos = { x: origin.x + 2, y: origin.y, z: origin.z };
  let e;
  try {
    e = dim.spawnEntity("trickymaze:old_prison_patroller", pos);
  } catch (err) {
    console.warn(`[TrickyMaze] smoke: spawnEntity failed: ${String(err)}`);
    return;
  }
  if (!e) {
    console.warn("[TrickyMaze] smoke: spawnEntity returned undefined.");
    return;
  }
  e.setDynamicProperty("trickymaze:behavior", "patroller");
  e.setDynamicProperty("trickymaze:home_x", pos.x);
  e.setDynamicProperty("trickymaze:home_y", pos.y);
  e.setDynamicProperty("trickymaze:home_z", pos.z);
  e.setDynamicProperty("trickymaze:patrol_axis", "E");
  e.setDynamicProperty("trickymaze:patrol_length", 12);
  e.setDynamicProperty("trickymaze:damage_mult", 1);

  system.runTimeout(() => {
    const n = dim.getEntities({ families: ["trickymaze_patroller"] }).length;
    const msg = n >= 1 ? "§aPASS" : "§cFAIL";
    world.sendMessage(`${msg} §7smoke_monsters (patroller count: ${n})`);
    console.warn(`[TrickyMaze] smoke_monsters patroller count: ${n}`);
    try { e.remove(); } catch { /* ignore */ }
  }, 10);
}
