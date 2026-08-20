import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync(new URL("./pages/Home.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("welcome envelope and photo puzzle", () => {
  it("uses the owner-selected gallery image for the welcome highlight and a playable 3x3 puzzle", () => {
    expect(home).toContain("legacy-welcome-envelope");
    expect(home).toContain("const puzzlePhoto = photos.find");
    expect(home).toContain("src={puzzlePhoto.url}");
    expect(home).toContain("Array.from({ length: 9 }");
    expect(home).toContain("legacy-photo-puzzle");
  });

  it("uses the selected puzzle image id while retaining a gallery fallback", () => {
    expect(home).toContain("photo.id === features.puzzleImageId");
    expect(home).toContain("backgroundImage: `url(${puzzlePhoto.url})`");
  });

  it("includes mobile-friendly styles with reduced-motion support for the new entrance experience", () => {
    expect(css).toContain(".legacy-welcome-envelope");
    expect(css).toContain(".legacy-photo-puzzle");
    expect(css).toContain("prefers-reduced-motion");
  });
});
