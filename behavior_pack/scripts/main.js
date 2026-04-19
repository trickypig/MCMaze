import { world } from "@minecraft/server";
// worldInitialize is present in older API versions; guard with optional chaining.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
world.afterEvents.worldInitialize?.subscribe(() => {
    console.warn("[TrickyMaze] Script loaded.");
});
// Fallback sanity log for versions where worldInitialize fires before subscribe.
console.warn("[TrickyMaze] main.ts imported.");
