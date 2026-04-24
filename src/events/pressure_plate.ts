import { world, GameMode } from "@minecraft/server";
import { ANCHOR, prisonSpec } from "./first_join";
import { RunPhase, type RunState } from "../state/run";
import { buildFloor } from "../generation/floor";
import { generateMaze } from "../generation/maze";
import { applyOps } from "../generation/world_writer";
import { buildSpawnManifest } from "../generation/spawn_plan";
import { spawnFromManifest } from "../monsters/spawner";
import { commitState } from "../main";
import { worldSeededRng } from "../generation/rng";

const FLOOR_Y_GAP = 6;

export function handlePressurePlate(state: RunState): void {
  if (state.phase !== RunPhase.Prison) return;
  if (!prisonSpec) {
    console.warn("[TrickyMaze] Pressure plate pressed but prison not built yet.");
    return;
  }

  const floorNum = state.floor + 1;
  const size = 12 + (floorNum - 1) * 4;
  const rng = worldSeededRng(floorNum);

  const maze = generateMaze(Math.min(size, 40), Math.min(size, 40), rng);
  const floorAnchor = {
    x: ANCHOR.x,
    y: ANCHOR.y - FLOOR_Y_GAP * floorNum,
    z: ANCHOR.z,
  };

  const spec = buildFloor(maze, {
    anchor: floorAnchor,
    wallBlock: "minecraft:stone_bricks",
    floorBlock: "minecraft:stone_bricks",
    ceilingBlock: "minecraft:stone_bricks",
  });

  applyOps(spec.operations);
  state.startFloor(floorNum);
  commitState();

  // Spawn monsters after block placement completes.
  const manifest = buildSpawnManifest(maze, floorNum, worldSeededRng(floorNum + 1_000_000));
  const dim = world.getDimension("overworld");
  const spawnedCount = spawnFromManifest(dim, floorAnchor, manifest, floorNum);
  console.warn(`[TrickyMaze] Floor ${floorNum} spawned ${spawnedCount} monsters.`);

  // Teleport all living players to the entrance.
  const entrance = spec.entranceBlock;
  for (const p of world.getAllPlayers()) {
    if (!state.isAlive(p.id)) continue;
    p.teleport(
      { x: entrance.x + 0.5, y: entrance.y, z: entrance.z + 0.5 },
      { dimension: dim },
    );
    p.setGameMode(GameMode.Adventure);
  }

  world.sendMessage(`§6You descend into the maze. Floor ${floorNum}.`);
}
