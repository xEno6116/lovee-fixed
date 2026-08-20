import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("dark visual theme contrast", () => {
  it("uses a dark main surface for Midnight Date instead of the shared light background", () => {
    expect(styles).toContain(".legacy-anniversary.legacy-visual-midnight-date .legacy-main-content");
    expect(styles).toContain("#0f0b1a !important");
  });

  it("sets readable light text for main content and question forms across dark variants", () => {
    expect(styles).toContain(".legacy-visual-midnight-date,.legacy-night,.legacy-bg-night");
    expect(styles).toContain("color: #f8fafc !important");
    expect(styles).toContain(".legacy-question-modal textarea::placeholder { color: #c4b5fd; }");
  });
});
