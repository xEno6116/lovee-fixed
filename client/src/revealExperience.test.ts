import { describe, expect, it } from "vitest";
import { getRevealContent } from "./revealExperience";

describe("getRevealContent", () => {
  it("prioritizes configured welcome copy for the opening reveal", () => {
    expect(getRevealContent({ siteTitle: "LoveOffice", welcomeTitle: "สำหรับเจน", welcomeMessage: "รักเสมอ", memoryMessage: "ข้อความหลัก" })).toEqual({ headline: "สำหรับเจน", message: "รักเสมอ" });
  });

  it("falls back to the site title and memory message when welcome copy is empty", () => {
    expect(getRevealContent({ siteTitle: "LoveOffice", welcomeTitle: "", welcomeMessage: "", memoryMessage: "ความทรงจำของเรา" })).toEqual({ headline: "LoveOffice", message: "ความทรงจำของเรา" });
  });
});
