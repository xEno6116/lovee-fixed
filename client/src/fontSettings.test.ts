import { describe, expect, it } from "vitest";
import { getFontPreviewFamily, resetFontChoice } from "./fontSettings";

describe("font settings helpers", () => {
  it("previews an uploaded font before system font choices", () => {
    expect(getFontPreviewFamily({ fontFamily: "serif", customFontUrl: "/manus-storage/font.woff2", customFontName: "memory" })).toContain("AnniversaryCustom");
    expect(getFontPreviewFamily({ fontFamily: "sans", customFontUrl: "", customFontName: "" })).toContain("Noto Sans Thai");
  });

  it("restores the standard handwritten font and clears custom font details", () => {
    expect(resetFontChoice({ fontFamily: "serif", customFontUrl: "/manus-storage/font.ttf", customFontName: "memory.ttf" })).toMatchObject({ fontFamily: "gaegu", customFontUrl: "", customFontName: "" });
  });
});
