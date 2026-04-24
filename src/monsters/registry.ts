import type { Entity } from "@minecraft/server";

export type TickFn = (entity: Entity) => void;

const registry = new Map<string, TickFn>();

export function registerBehavior(name: string, fn: TickFn): void {
  if (registry.has(name)) {
    console.warn(`[TrickyMaze] behavior '${name}' registered twice; overriding.`);
  }
  registry.set(name, fn);
}

export function getBehavior(name: string): TickFn | undefined {
  return registry.get(name);
}
