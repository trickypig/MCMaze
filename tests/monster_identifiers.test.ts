import { describe, it, expect } from "vitest";
import { resolveEntityId } from "../src/monsters/identifiers";

describe("resolveEntityId", () => {
  it("returns the old_prison patroller", () => {
    expect(resolveEntityId("patroller", "old_prison")).toBe(
      "trickymaze:old_prison_patroller",
    );
  });
  it("returns the old_prison sleeper", () => {
    expect(resolveEntityId("sleeper", "old_prison")).toBe(
      "trickymaze:old_prison_sleeper",
    );
  });
  it("returns depths variants", () => {
    expect(resolveEntityId("patroller", "depths")).toBe(
      "trickymaze:depths_patroller",
    );
    expect(resolveEntityId("sleeper", "depths")).toBe(
      "trickymaze:depths_sleeper",
    );
    expect(resolveEntityId("lurker", "depths")).toBe(
      "trickymaze:depths_lurker",
    );
  });
  it("returns sentry archers per theme", () => {
    expect(resolveEntityId("sentry_archer", "old_prison")).toBe(
      "trickymaze:old_prison_sentry",
    );
    expect(resolveEntityId("sentry_archer", "depths")).toBe(
      "trickymaze:depths_sentry",
    );
  });
  it("throws for unpopulated theme combos", () => {
    expect(() => resolveEntityId("lurker", "old_prison")).toThrow(
      /no entity registered/,
    );
  });
});
