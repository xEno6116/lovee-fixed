import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync(new URL("./pages/Home.tsx", import.meta.url), "utf8");

describe("question letter submission lock", () => {
  it("locks the public question letter after a successful response", () => {
    expect(home).toContain("const questionLetterLocked = Boolean(site.letterSubmitted || questionSubmitted)");
    expect(home).toContain("legacy-question-letter-locked");
    expect(home).toContain("จดหมายฉบับนี้ปิดรับคำตอบแล้ว");
  });
});
