import { describe, expect, it } from "vitest";
import { getUiLayout, uiLayouts } from "./uiLayouts";

describe("UI layouts", () => {
  it("provides exactly three distinct public presentation modes", () => {
    expect(uiLayouts.map((layout) => layout.id)).toEqual(["soft-story", "polaroid-journal", "midnight-glass"]);
    expect(new Set(uiLayouts.map((layout) => layout.name)).size).toBe(3);
  });

  it("uses the original Soft Story presentation for an unknown or old site setting", () => {
    expect(getUiLayout(undefined).id).toBe("soft-story");
    expect(getUiLayout("legacy-layout").id).toBe("soft-story");
  });
});
