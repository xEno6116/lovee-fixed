import { describe, expect, it } from "vitest";
import { memoryFeatureGuide } from "./memoryFeatureGuide";

describe("memory feature guide", () => {
  it("lists each new public feature with an actionable Settings destination", () => {
    expect(memoryFeatureGuide).toHaveLength(3);
    expect(memoryFeatureGuide.map((item) => item.title)).toEqual(["จดหมายลับ", "ไพ่สุ่มความทรงจำ", "รูปเต็มจอ"]);
    expect(memoryFeatureGuide.every((item) => item.description.includes("ใช้") || item.description.includes("อัปโหลด"))).toBe(true);
  });
});
