import { world } from "@minecraft/server";
world.afterEvents.worldLoad.subscribe(() => {
    console.warn("[TrickyMaze] World loaded.");
});
// Top-level log — fires at module import, before worldLoad.
console.warn("[TrickyMaze] Module imported (pre-world).");
