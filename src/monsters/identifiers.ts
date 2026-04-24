import type { ThemeId } from "../generation/themes";

export type Behavior = "patroller";

const IDENTIFIER_TABLE: Record<Behavior, Partial<Record<ThemeId, string>>> = {
  patroller: { old_prison: "trickymaze:patroller_zombie" },
};

export function resolveEntityId(behavior: Behavior, theme: ThemeId): string {
  const id = IDENTIFIER_TABLE[behavior]?.[theme];
  if (!id) throw new Error(`no entity registered for ${behavior}/${theme}`);
  return id;
}
