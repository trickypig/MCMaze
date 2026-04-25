import { world, GameMode, ItemStack } from "@minecraft/server";
import { ANCHOR, getPrisonSpec } from "./first_join";
import { RunPhase } from "../state/run";
import { buildFloor } from "../generation/floor";
import { generateMaze } from "../generation/maze";
import { applyOps } from "../generation/world_writer";
import { buildSpawnManifest } from "../generation/spawn_plan";
import { spawnFromManifest, despawnAllMonsters } from "../monsters/spawner";
import { commitState } from "../main";
import { worldSeededRng } from "../generation/rng";
import { themeForFloor } from "../generation/themes";
import { buildFixtures } from "../generation/fixtures";
import { KEY_ITEM_TYPE, KEY_DISPLAY_NAME, KEY_LORE } from "../generation/key_item";
import { lootTierForFloor } from "../generation/chest_placement";
export const FLOOR_DEPTH = 10;
const FLOOR_Y_SPAN_PAD = 5;
export let activeFloor = null;
export function setActiveFloor(f) {
    activeFloor = f;
}
export function getActiveFloor() {
    return activeFloor;
}
export function handlePressurePlate(state) {
    if (state.phase !== RunPhase.Prison)
        return;
    if (!getPrisonSpec()) {
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
export function buildAndEnterFloor(state, floorNum) {
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
    const fixtures = buildFixtures(maze, floorSpec, anchor, worldSeededRng(floorNum + 1000));
    applyOps(fixtures.operations);
    // Place the key in the chest (runtime-only; not part of fixture ops).
    placeKeyInChest(fixtures.chestPos);
    // Populate loot chests via Bedrock loot tables. Fixture ops already placed
    // the chest blocks; /loot fills them from the per-tier table.
    const tier = lootTierForFloor(floorNum);
    const armoryTable = `trickymaze/armory_t${tier}`;
    const supplyTable = `trickymaze/supply_t${tier}`;
    for (const p of fixtures.armoryChestPositions) {
        fillChestFromLootTable(p, armoryTable);
    }
    for (const p of fixtures.supplyChestPositions) {
        fillChestFromLootTable(p, supplyTable);
    }
    // Register ticking area for this floor so chunks stay resident.
    const tickingAreaName = `tm_floor_${floorNum}`;
    const dim = world.getDimension("overworld");
    try {
        dim.runCommand(`tickingarea remove ${tickingAreaName}`);
    }
    catch {
        /* no existing area */
    }
    dim.runCommand(`tickingarea add ${anchor.x - FLOOR_Y_SPAN_PAD} ${anchor.y - FLOOR_Y_SPAN_PAD} ${anchor.z - FLOOR_Y_SPAN_PAD} ` +
        `${floorSpec.bounds.max.x + FLOOR_Y_SPAN_PAD} ${floorSpec.bounds.max.y + FLOOR_Y_SPAN_PAD} ${floorSpec.bounds.max.z + FLOOR_Y_SPAN_PAD} ` +
        `${tickingAreaName} true`);
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
    // Despawn any monsters left over from the previous floor — sealed off
    // below us, but still counted by the HUD's family-wide scan.
    const removed = despawnAllMonsters(dim);
    if (removed > 0)
        console.warn(`[TrickyMaze] Despawned ${removed} stale monsters from prior floor.`);
    // Spawn monsters after block + fixture placement completes.
    const manifest = buildSpawnManifest(maze, floorNum, worldSeededRng(floorNum + 1_000_000));
    const spawnedCount = spawnFromManifest(dim, anchor, manifest, floorNum);
    console.warn(`[TrickyMaze] Floor ${floorNum} spawned ${spawnedCount} monsters.`);
    // Teleport every alive player to the entrance.
    const entrance = floorSpec.entranceBlock;
    for (const p of world.getAllPlayers()) {
        if (!state.isAlive(p.id))
            continue;
        p.teleport({ x: entrance.x + 0.5, y: entrance.y, z: entrance.z + 0.5 }, { dimension: dim });
        p.setGameMode(GameMode.Adventure);
    }
    world.sendMessage(`§6You descend into the maze. Floor ${floorNum}.`);
}
function fillChestFromLootTable(pos, table) {
    const dim = world.getDimension("overworld");
    const cmd = `loot insert ${pos.x} ${pos.y} ${pos.z} loot "${table}"`;
    try {
        dim.runCommand(cmd);
    }
    catch (e) {
        console.warn(`[TrickyMaze] loot command failed: '${cmd}' — ${String(e)}`);
    }
}
function placeKeyInChest(pos) {
    const dim = world.getDimension("overworld");
    let block;
    try {
        block = dim.getBlock(pos);
    }
    catch (e) {
        console.warn(`[TrickyMaze] getBlock failed at ${pos.x},${pos.y},${pos.z}: ${String(e)}`);
        return;
    }
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
