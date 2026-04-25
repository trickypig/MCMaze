import { world, system, Player } from "@minecraft/server";
import { RunPhase } from "../state/run";
import { activeFloor } from "./pressure_plate";
import { playerHasKey, consumeKey } from "./key_inventory";
import { beginDescent, isDescentInFlight } from "./descent";
const NO_KEY_MSG_COOLDOWN_TICKS = 20;
const noKeyMsgByPlayer = new Map();
export function registerExitPlateHandler(state) {
    world.afterEvents.pressurePlatePush.subscribe((ev) => {
        if (state.phase !== RunPhase.FloorActive)
            return;
        if (isDescentInFlight())
            return;
        if (!activeFloor)
            return;
        const plate = activeFloor.fixtures.exitPlatePos;
        const loc = ev.block.location;
        if (loc.x !== plate.x || loc.y !== plate.y || loc.z !== plate.z)
            return;
        const src = ev.source;
        if (!(src instanceof Player))
            return;
        if (!state.isAlive(src.id))
            return;
        if (playerHasKey(src)) {
            handleKeyedStep(state, src);
        }
        else {
            maybeSendNoKeyMessage(src);
        }
    });
}
function handleKeyedStep(state, player) {
    consumeKey(player);
    openExitDoor();
    beginDescent(state);
}
function openExitDoor() {
    if (!activeFloor)
        return;
    const doorPos = activeFloor.fixtures.exitDoorPos;
    const dim = world.getDimension("overworld");
    dim.runCommand(`setblock ${doorPos.x} ${doorPos.y - 1} ${doorPos.z} minecraft:redstone_block`);
}
function maybeSendNoKeyMessage(player) {
    const now = system.currentTick;
    const last = noKeyMsgByPlayer.get(player.id) ?? 0;
    if (now - last < NO_KEY_MSG_COOLDOWN_TICKS)
        return;
    player.sendMessage("§cYou need the floor key.");
    noKeyMsgByPlayer.set(player.id, now);
}
