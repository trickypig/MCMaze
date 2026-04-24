/**
 * Ephemeral per-entity behavior state. Keyed by entity.id. Cleared on
 * entity death/removal so the map stays bounded. Lost on script reload
 * by design — behaviors whose runtime state matters across reloads must
 * promote fields to dynamic properties.
 */
const runtime = new Map();
export function getRuntime(entityId) {
    return runtime.get(entityId);
}
export function setRuntime(entityId, state) {
    runtime.set(entityId, state);
}
export function clearRuntime(entityId) {
    runtime.delete(entityId);
}
export function runtimeSize() {
    return runtime.size;
}
