import { describe, it, expect } from "vitest";
import { themeForFloor, resolveEntityId } from "../src/monsters/themes";

describe("themeForFloor", () => {
  it("maps floors 1–2 to old_prison", () => {
    expect(themeForFloor(1)).toBe("old_prison");
    expect(themeForFloor(2)).toBe("old_prison");
  });
  it("maps floors 3–4 to the_depths", () => {
    expect(themeForFloor(3)).toBe("the_depths");
    expect(themeForFloor(4)).toBe("the_depths");
  });
  it("maps floors 5–6 to nethers_edge", () => {
    expect(themeForFloor(5)).toBe("nethers_edge");
    expect(themeForFloor(6)).toBe("nethers_edge");
  });
  it("maps floors 7+ to the_abyss", () => {
    expect(themeForFloor(7)).toBe("the_abyss");
    expect(themeForFloor(20)).toBe("the_abyss");
  });
});

describe("resolveEntityId", () => {
  it("returns the zombie patroller for old_prison", () => {
    expect(resolveEntityId("patroller", "old_prison")).toBe(
      "trickymaze:patroller_zombie",
    );
  });
  it("throws for unpopulated theme combos", () => {
    expect(() => resolveEntityId("patroller", "the_depths")).toThrow(
      /no entity registered/,
    );
  });
});
