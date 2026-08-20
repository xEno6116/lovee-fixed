import { describe, expect, it } from "vitest";
import { getVisualTheme, visualThemes } from "./themeGallery";

describe("Theme Gallery", () => {
  it("ships six distinct theme choices", () => {
    expect(visualThemes).toHaveLength(6);
    expect(new Set(visualThemes.map((theme) => theme.id)).size).toBe(6);
  });

  it("falls back safely to Soft Love for existing sites", () => {
    expect(getVisualTheme(undefined).id).toBe("soft-love");
    expect(getVisualTheme("unknown").id).toBe("soft-love");
  });
});
