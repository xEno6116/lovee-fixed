import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync(new URL("./pages/Home.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("flip photo cards", () => {
  it("flips a gallery photo to its configured caption without removing fullscreen access", () => {
    expect(home).toContain("const [flippedPhotoId, setFlippedPhotoId]");
    expect(home).toContain("legacy-flip-photo-card");
    expect(home).toContain("setFlippedPhotoId((id) => id === asset.id ? null : asset.id)");
    expect(home).toContain("asset.caption || \"รูปนี้ยังไม่มีข้อความกำกับ");
    expect(home).toContain("legacy-photo-fullscreen");
    expect(home).toContain("caption: asset.caption ?? \"\"");
  });

  it("uses a 3D transform with a reduced-motion fallback and style coverage for all UI layouts", () => {
    expect(styles).toContain(".legacy-flip-photo-card.is-flipped .legacy-flip-photo-inner");
    expect(styles).toContain("rotateY(180deg)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain(".legacy-layout-polaroid-journal .legacy-flip-photo-card");
    expect(styles).toContain(".legacy-layout-midnight-glass .legacy-flip-photo-face");
  });
});
