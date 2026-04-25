import type { ThemeId } from "../generation/themes";

export type Behavior = "patroller" | "sleeper" | "lurker" | "sentry_archer";

const IDENTIFIER_TABLE: Record<Behavior, Partial<Record<ThemeId, string>>> = {
  patroller: {
    old_prison: "trickymaze:patroller_zombie",
    depths: "trickymaze:patroller_wither_skeleton",
  },
  sleeper: {
    old_prison: "trickymaze:sleeper_zombie_villager",
    depths: "trickymaze:sleeper_wither_skeleton",
  },
  lurker: {
    depths: "trickymaze:lurker_wither_skeleton",
  },
  sentry_archer: {
    old_prison: "trickymaze:sentry_archer_skeleton",
    depths: "trickymaze:sentry_archer_stray",
  },
};

export function resolveEntityId(behavior: Behavior, theme: ThemeId): string {
  const id = IDENTIFIER_TABLE[behavior]?.[theme];
  if (!id) throw new Error(`no entity registered for ${behavior}/${theme}`);
  return id;
}
