import { describe, expect, it } from "vitest";
import { createFloatingHeart } from "./heartEffect";

describe("createFloatingHeart", () => {
  it("keeps the click origin and creates a visible bounded animation seed", () => {
    const heart = createFloatingHeart({ id: "heart-1", x: 120, y: 260 }, () => 0.5);
    expect(heart).toEqual({ id: "heart-1", x: 120, y: 260, size: 28, drift: 0 });
  });
});
