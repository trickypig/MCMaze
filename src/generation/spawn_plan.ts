import type { Maze } from "./maze";

export type SpawnBehavior = "patroller";
export type SpawnTheme = "old_prison";
export type Axis = "N" | "S" | "E" | "W";

export type SpawnManifestEntry = {
  behavior: SpawnBehavior;
  theme: SpawnTheme;
  // Block-local position within the maze footprint (not world).
  // Cell (cx, cy) centers at (3*cx+2, 1, 3*cy+2).
  pos: { x: number; y: number; z: number };
  config: {
    homePoint: { x: number; y: number; z: number };
    patrolAxis: Axis;
    patrolLength: number;
  };
};

/**
 * Analyze a maze and emit a list of monster spawn entries. Plan 2 only
 * produces Patrollers for the L1–2 "old_prison" theme.
 */
export function buildSpawnManifest(
  maze: Maze,
  floor: number,
  rng: () => number,
): SpawnManifestEntry[] {
  return [];
}
