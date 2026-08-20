import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync(new URL("./pages/Home.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("cassette music player", () => {
  it("renders a draggable cassette with real restart and play controls", () => {
    expect(home).toContain("legacy-tape-player");
    expect(home).toContain("restartMusic");
    expect(home).toContain("aria-label=\"เริ่มเพลงใหม่\"");
  });

  it("spins cassette reels only while music is playing and honors reduced motion", () => {
    expect(styles).toContain(".legacy-tape-player.playing .legacy-tape-reel { animation: legacy-tape-reel-spin");
    expect(styles).toContain(".legacy-cd-disc, .legacy-cd-disc::after, .legacy-cd-case, .legacy-tape-reel { animation: none !important; }");
  });
});
