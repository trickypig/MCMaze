/**
 * Ephemeral per-entity behavior state. Keyed by entity.id. Cleared on
 * entity death/removal so the map stays bounded. Lost on script reload
 * by design — behaviors whose runtime state matters across reloads must
 * promote fields to dynamic properties.
 */
const runtime = new Map<string, unknown>();

export function getRuntime<T>(entityId: string): T | undefined {
  return runtime.get(entityId) as T | undefined;
}

export function setRuntime<T>(entityId: string, state: T): void {
  runtime.set(entityId, state);
}

export function clearRuntime(entityId: string): void {
  runtime.delete(entityId);
}

export function runtimeSize(): number {
  return runtime.size;
}
