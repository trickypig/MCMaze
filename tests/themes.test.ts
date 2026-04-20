import { describe, it, expect } from "vitest";
import { themeForFloor, THEMES } from "../src/generation/themes";

describe("themeForFloor", () => {
  it("floors 1-2 use old_prison palette", () => {
    expect(themeForFloor(1).id).toBe("old_prison");
    expect(themeForFloor(2).id).toBe("old_prison");
  });

  it("floors 3-4 use depths palette", () => {
    expect(themeForFloor(3).id).toBe("depths");
    expect(themeForFloor(4).id).toBe("depths");
  });

  it("floor 5+ defaults to depths (safe fallback)", () => {
    expect(themeForFloor(5).id).toBe("depths");
    expect(themeForFloor(99).id).toBe("depths");
  });

  it("THEMES has exactly two entries", () => {
    expect(Object.keys(THEMES).sort()).toEqual(["depths", "old_prison"]);
  });

  it("each theme has wall, floor, ceiling block ids", () => {
    for (const t of Object.values(THEMES)) {
      expect(t.wall).toMatch(/^minecraft:/);
      expect(t.floor).toMatch(/^minecraft:/);
      expect(t.ceiling).toMatch(/^minecraft:/);
    }
  });
});
