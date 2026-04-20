import { describe, it, expect } from "vitest";
import { KEY_ITEM_TYPE, KEY_DISPLAY_NAME, KEY_LORE } from "../src/generation/key_item";

describe("key item constants", () => {
  it("uses tripwire_hook type", () => {
    expect(KEY_ITEM_TYPE).toBe("minecraft:tripwire_hook");
  });

  it("has a colored display name starting with §e", () => {
    expect(KEY_DISPLAY_NAME).toBe("§eFloor Key");
  });

  it("has lore text", () => {
    expect(KEY_LORE).toEqual(["§7Opens the exit door"]);
  });
});
