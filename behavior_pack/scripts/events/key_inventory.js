import { KEY_ITEM_TYPE, KEY_DISPLAY_NAME } from "../generation/key_item";
/**
 * Returns the slot index holding a Floor Key, or -1 if none found.
 * Matches on both item type and display name, so stray vanilla
 * tripwire hooks are not consumed.
 */
export function findKeySlot(container) {
    for (let i = 0; i < container.size; i++) {
        const stack = container.getItem(i);
        if (!stack)
            continue;
        if (stack.typeId !== KEY_ITEM_TYPE)
            continue;
        if (stack.nameTag !== KEY_DISPLAY_NAME)
            continue;
        return i;
    }
    return -1;
}
/**
 * Remove exactly one key from the player's inventory (from the first
 * matching slot). No-op if the player has no key.
 */
export function consumeKey(player) {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container)
        return false;
    const slot = findKeySlot(container);
    if (slot === -1)
        return false;
    const stack = container.getItem(slot);
    if (!stack)
        return false;
    if (stack.amount <= 1) {
        container.setItem(slot, undefined);
    }
    else {
        stack.amount = stack.amount - 1;
        container.setItem(slot, stack);
    }
    return true;
}
/**
 * Lightweight read-only check; used by the plate poll to decide between
 * triggering descent vs. showing the "you need a key" message.
 */
export function playerHasKey(player) {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container)
        return false;
    return findKeySlot(container) !== -1;
}
