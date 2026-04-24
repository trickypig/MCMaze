export type ThemeId = "old_prison" | "depths";

export interface Theme {
  id: ThemeId;
  wall: string;
  floor: string;
  ceiling: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  old_prison: {
    id: "old_prison",
    wall: "minecraft:stone_bricks",
    floor: "minecraft:cobblestone",
    ceiling: "minecraft:stone_bricks",
  },
  depths: {
    id: "depths",
    wall: "minecraft:deepslate_bricks",
    floor: "minecraft:blackstone",
    ceiling: "minecraft:deepslate_tiles",
  },
};

export function themeForFloor(n: number): Theme {
  if (n <= 2) return THEMES.old_prison;
  return THEMES.depths;
}
