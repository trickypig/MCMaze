const registry = new Map();
export function registerBehavior(name, fn) {
    if (registry.has(name)) {
        console.warn(`[TrickyMaze] behavior '${name}' registered twice; overriding.`);
    }
    registry.set(name, fn);
}
export function getBehavior(name) {
    return registry.get(name);
}
