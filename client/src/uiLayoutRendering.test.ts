import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync(new URL("./pages/Home.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("./pages/Settings.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("public UI layout rendering", () => {
  it("applies the saved uiLayout to the same Home feature surface", () => {
    expect(home).toContain("getUiLayout(features.uiLayout)");
    expect(home).toContain("legacy-layout-${uiLayout.id}");
    expect(home).toContain("legacy-tape-player");
    expect(home).toContain("legacy-photo-puzzle");
    expect(home).toContain("legacy-question-letter");
  });

  it("shows a three-layout picker and has distinct public styles for all modes", () => {
    expect(settings).toContain("UI Layout — เลือกรูปแบบหน้าบ้าน");
    expect(settings).toContain("uiLayouts.map");
    expect(styles).toContain(".legacy-layout-soft-story");
    expect(styles).toContain(".legacy-layout-polaroid-journal");
    expect(styles).toContain(".legacy-layout-midnight-glass");
  });
});
