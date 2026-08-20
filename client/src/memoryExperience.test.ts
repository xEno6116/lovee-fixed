import { describe, expect, it } from "vitest";
import { isReleasedAt, nextMemoryIndex } from "./memoryExperience";

describe("memory experience helpers", () => {
  it("cycles through available memory cards without overflowing", () => {
    expect(nextMemoryIndex(0, 3)).toBe(1);
    expect(nextMemoryIndex(2, 3)).toBe(0);
    expect(nextMemoryIndex(0, 0)).toBe(0);
  });

  it("keeps timed memories locked until their configured time", () => {
    expect(isReleasedAt("", 1_000)).toBe(true);
    expect(isReleasedAt("1970-01-01T00:00:02.000Z", 1_000)).toBe(false);
    expect(isReleasedAt("1970-01-01T00:00:00.500Z", 1_000)).toBe(true);
  });
});
