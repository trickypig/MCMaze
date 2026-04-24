import { resolveEntityId } from "./identifiers";
import { healthMultiplier, damageMultiplier } from "./stats";
export function spawnFromManifest(dim, anchor, manifest, floor) {
    let spawned = 0;
    const hpMul = healthMultiplier(floor);
    const dmgMul = damageMultiplier(floor);
    for (const entry of manifest) {
        let identifier;
        try {
            identifier = resolveEntityId(entry.behavior, entry.theme);
        }
        catch (e) {
            console.warn(`[TrickyMaze] spawn skip: ${String(e)}`);
            continue;
        }
        const worldPos = {
            x: anchor.x + entry.pos.x,
            y: anchor.y + entry.pos.y,
            z: anchor.z + entry.pos.z,
        };
        const homeWorld = {
            x: anchor.x + entry.config.homePoint.x,
            y: anchor.y + entry.config.homePoint.y,
            z: anchor.z + entry.config.homePoint.z,
        };
        let entity;
        try {
            entity = dim.spawnEntity(identifier, worldPos);
        }
        catch (e) {
            console.warn(`[TrickyMaze] spawnEntity(${identifier}) at ${worldPos.x},${worldPos.y},${worldPos.z} failed: ${String(e)}`);
            continue;
        }
        if (!entity)
            continue;
        try {
            entity.setDynamicProperty("trickymaze:behavior", entry.behavior);
            entity.setDynamicProperty("trickymaze:home_x", homeWorld.x);
            entity.setDynamicProperty("trickymaze:home_y", homeWorld.y);
            entity.setDynamicProperty("trickymaze:home_z", homeWorld.z);
            entity.setDynamicProperty("trickymaze:patrol_axis", entry.config.patrolAxis);
            entity.setDynamicProperty("trickymaze:patrol_length", entry.config.patrolLength);
            entity.setDynamicProperty("trickymaze:damage_mult", dmgMul);
            const health = entity.getComponent("minecraft:health");
            if (health) {
                const scaledMax = Math.round(20 * hpMul);
                // setCurrentValue clamps to effectiveMax, so set through setBaseEffectForId.
                health.setCurrentValue(scaledMax);
            }
        }
        catch (e) {
            console.warn(`[TrickyMaze] spawn config failed on ${identifier}: ${String(e)}`);
        }
        spawned += 1;
    }
    return spawned;
}
export function despawnAllMonsters(dim) {
    let count = 0;
    const entities = dim.getEntities({ families: ["trickymaze"] });
    for (const e of entities) {
        try {
            e.remove();
            count += 1;
        }
        catch { /* ignore */ }
    }
    return count;
}
