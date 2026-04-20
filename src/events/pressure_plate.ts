import { world, GameMode, system, ItemStack } from "@minecraft/server";
import { ANCHOR, prisonSpec } from "./first_join";
import { RunPhase, type RunState } from "../state/run";
import { buildFloor } from "../generation/floor";
import { generateMaze } from "../generation/maze";
import { applyOps } from "../generation/world_writer";
import { commitState } from "../main";
import { worldSeededRng } from "../generation/rng";
import { themeForFloor } from "../generation/themes";
import { buildFixtures } from "../generation/fixtures";
import { KEY_ITEM_TYPE, KEY_DISPLAY_NAME, KEY_LORE } from "../generation/key_item";
import type { FloorFixtures } from "../generation/fixtures";

const FLOOR_DEPTH = 30;
const FLOOR_Y_SPAN_PAD = 5;

export interface ActiveFloor {
  floor: number;
  anchor: { x: number; y: number; z: number };
  fixtures: FloorFixtures;
  tickingAreaName: string;
  size: number;
}

export let activeFloor: ActiveFloor | null = null;

export function setActiveFloor(f: ActiveFloor | null): void {
  activeFloor = f;
}

export function handlePressurePlate(state: RunState): void {
  if (state.phase !== RunPhase.Prison) return;
  if (!prisonSpec) {
    console.warn("[TrickyMaze] Pressure plate pressed but prison not built yet.");
    return;
  }

  const floorNum = 1; // Prison plate always starts floor 1.
  buildAndEnterFloor(state, floorNum);
}

/**
 * Shared builder used by both the prison plate (entering floor 1) and the
 * descent transition (entering floor N+1).
 */
export function buildAndEnterFloor(state: RunState, floorNum: number): void {
  const size = Math.min(20, 12 + (floorNum - 1) * 4);
  const rng = worldSeededRng(floorNum);
  const maze = generateMaze(size, size, rng);

  const theme = themeForFloor(floorNum);
  const anchor = {
    x: ANCHOR.x,
    y: ANCHOR.y - FLOOR_DEPTH * floorNum,
    z: ANCHOR.z,
  };

  const floorSpec = buildFloor(maze, {
    anchor,
    wallBlock: theme.wall,
    floorBlock: theme.floor,
    ceilingBlock: theme.ceiling,
  });
  applyOps(floorSpec.operations);

  const fixtures = buildFixtures(maze, floorSpec, anchor);
  applyOps(fixtures.operations);

  // Place the key in the chest (runtime-only; not part of fixture ops).
  placeKeyInChest(fixtures.chestPos);

  // Register ticking area for this floor so chunks stay resident.
  const tickingAreaName = `tm_floor_${floorNum}`;
  const dim = world.getDimension("overworld");
  try {
    dim.runCommand(`tickingarea remove ${tickingAreaName}`);
  } catch {
    /* no existing area */
  }
  dim.runCommand(
    `tickingarea add ${anchor.x - FLOOR_Y_SPAN_PAD} ${anchor.y - FLOOR_Y_SPAN_PAD} ${anchor.z - FLOOR_Y_SPAN_PAD} ` +
      `${floorSpec.bounds.max.x + FLOOR_Y_SPAN_PAD} ${floorSpec.bounds.max.y + FLOOR_Y_SPAN_PAD} ${floorSpec.bounds.max.z + FLOOR_Y_SPAN_PAD} ` +
      `${tickingAreaName} true`,
  );
  state.trackTickingArea(tickingAreaName);

  state.startFloor(floorNum);

  setActiveFloor({
    floor: floorNum,
    anchor,
    fixtures,
    tickingAreaName,
    size,
  });

  commitState();

  // Teleport every alive player to the entrance.
  const entrance = floorSpec.entranceBlock;
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

function placeKeyInChest(pos: { x: number; y: number; z: number }): void {
  const dim = world.getDimension("overworld");
  const block = dim.getBlock(pos);
  if (!block) {
    console.warn(`[TrickyMaze] Could not place key — chest block not found at ${pos.x},${pos.y},${pos.z}`);
    return;
  }
  const container = block.getComponent("minecraft:inventory")?.container;
  if (!container) {
    console.warn("[TrickyMaze] Chest has no inventory container.");
    return;
  }
  const stack = new ItemStack(KEY_ITEM_TYPE, 1);
  stack.nameTag = KEY_DISPLAY_NAME;
  stack.setLore(KEY_LORE);
  container.setItem(0, stack);
}
