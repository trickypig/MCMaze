import { describe, it, expect } from "vitest";
import { resolveEntityId } from "../src/monsters/identifiers";

describe("resolveEntityId", () => {
  it("returns the zombie patroller for old_prison", () => {
    expect(resolveEntityId("patroller", "old_prison")).toBe(
      "trickymaze:patroller_zombie",
    );
  });
  it("throws for unpopulated theme combos", () => {
    expect(() => resolveEntityId("patroller", "depths")).toThrow(
      /no entity registered/,
    );
  });
});
