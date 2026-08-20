import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync(new URL("./pages/Home.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("welcome envelope and photo puzzle", () => {
  it("uses the first gallery image for the welcome highlight and a playable 3x3 puzzle", () => {
    expect(home).toContain("legacy-welcome-envelope");
    expect(home).toContain("src={photos[0].url}");
    expect(home).toContain("Array.from({ length: 9 }");
    expect(home).toContain("legacy-photo-puzzle");
  });

  it("includes mobile-friendly styles with reduced-motion support for the new entrance experience", () => {
    expect(css).toContain(".legacy-welcome-envelope");
    expect(css).toContain(".legacy-photo-puzzle");
    expect(css).toContain("prefers-reduced-motion");
  });
});
