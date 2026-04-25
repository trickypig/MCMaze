import { describe, it, expect } from "vitest";
import { resolveEntityId } from "../src/monsters/identifiers";

describe("resolveEntityId", () => {
  it("returns the zombie patroller for old_prison", () => {
    expect(resolveEntityId("patroller", "old_prison")).toBe(
      "trickymaze:patroller_zombie",
    );
  });
  it("returns the zombie villager sleeper for old_prison", () => {
    expect(resolveEntityId("sleeper", "old_prison")).toBe(
      "trickymaze:sleeper_zombie_villager",
    );
  });
  it("returns wither-skeleton variants for depths", () => {
    expect(resolveEntityId("patroller", "depths")).toBe(
      "trickymaze:patroller_wither_skeleton",
    );
    expect(resolveEntityId("sleeper", "depths")).toBe(
      "trickymaze:sleeper_wither_skeleton",
    );
    expect(resolveEntityId("lurker", "depths")).toBe(
      "trickymaze:lurker_wither_skeleton",
    );
  });
  it("returns the skeleton sentry archer for old_prison and stray for depths", () => {
    expect(resolveEntityId("sentry_archer", "old_prison")).toBe(
      "trickymaze:sentry_archer_skeleton",
    );
    expect(resolveEntityId("sentry_archer", "depths")).toBe(
      "trickymaze:sentry_archer_stray",
    );
  });
  it("throws for unpopulated theme combos", () => {
    expect(() => resolveEntityId("lurker", "old_prison")).toThrow(
      /no entity registered/,
    );
  });
});
