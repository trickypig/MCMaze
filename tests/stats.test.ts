import { describe, it, expect } from "vitest";
import { healthMultiplier, damageMultiplier } from "../src/monsters/stats";

describe("monster stats scaling", () => {
  it("is 1.0 on floor 1", () => {
    expect(healthMultiplier(1)).toBeCloseTo(1.0, 5);
    expect(damageMultiplier(1)).toBeCloseTo(1.0, 5);
  });

  it("is 1.9 on floor 10 (+10% per floor past 1)", () => {
    expect(healthMultiplier(10)).toBeCloseTo(1.9, 5);
    expect(damageMultiplier(10)).toBeCloseTo(1.9, 5);
  });

  it("is symmetric for hp and damage", () => {
    for (let f = 1; f <= 20; f++) {
      expect(healthMultiplier(f)).toBeCloseTo(damageMultiplier(f), 5);
    }
  });
});
