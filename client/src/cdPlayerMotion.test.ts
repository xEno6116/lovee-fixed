import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("CD player motion", () => {
  it("adds grooves, reflective light, and a subtle playing-state motion", () => {
    expect(styles).toContain("repeating-radial-gradient(circle,transparent 0 2px");
    expect(styles).toContain("@keyframes legacy-disc-glint");
    expect(styles).toContain("@keyframes legacy-case-breathe");
  });

  it("runs movement only while playing and disables it for reduced motion", () => {
    expect(styles).toContain(".legacy-cd-player.playing .legacy-cd-disc { animation-play-state: running; }");
    expect(styles).toContain(".legacy-cd-player.playing .legacy-cd-disc::after { animation: legacy-disc-glint");
    expect(styles).toContain(".legacy-cd-disc, .legacy-cd-disc::after, .legacy-cd-case { animation: none !important; }");
  });
});
