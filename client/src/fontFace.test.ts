import { describe, expect, it } from "vitest";
import { buildCustomFontFace } from "./fontFace";

describe("buildCustomFontFace", () => {
  it("uses the correct CSS font format for uploaded font extensions", () => {
    expect(buildCustomFontFace("/manus-storage/anniversary/1/fonts/memory.woff2")).toContain('format("woff2")');
    expect(buildCustomFontFace("/manus-storage/anniversary/1/fonts/memory.ttf")).toContain('format("truetype")');
    expect(buildCustomFontFace("/manus-storage/anniversary/1/fonts/memory.otf?version=1")).toContain('format("opentype")');
  });

  it("returns no rule when no custom font has been configured", () => {
    expect(buildCustomFontFace(" ")).toBe("");
  });
});
