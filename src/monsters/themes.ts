export type Behavior = "patroller";
export type Theme = "old_prison" | "the_depths" | "nethers_edge" | "the_abyss";

export const themeForFloor = (floor: number): Theme =>
  floor <= 2 ? "old_prison" :
  floor <= 4 ? "the_depths" :
  floor <= 6 ? "nethers_edge" : "the_abyss";

const IDENTIFIER_TABLE: Record<Behavior, Partial<Record<Theme, string>>> = {
  patroller: { old_prison: "trickymaze:patroller_zombie" },
};

export function resolveEntityId(behavior: Behavior, theme: Theme): string {
  const id = IDENTIFIER_TABLE[behavior]?.[theme];
  if (!id) throw new Error(`no entity registered for ${behavior}/${theme}`);
  return id;
}
