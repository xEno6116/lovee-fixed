import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync(new URL("./pages/Home.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("./pages/Settings.tsx", import.meta.url), "utf8");

describe("photo captions", () => {
  it("opens the configured caption with an image in the public gallery", () => {
    expect(home).toContain("caption: asset.caption ?? \"\"");
    expect(home).toContain("selectedPhoto.caption || selectedPhoto.originalName");
  });

  it("lets the owner write and save a caption for each gallery image", () => {
    expect(settings).toContain("site.admin.updateImageCaption.useMutation");
    expect(settings).toContain("เขียนข้อความหลังรูป เมื่อกดรูปจะเห็นข้อความนี้");
    expect(settings).toContain("บันทึกข้อความหลังรูป");
  });
});
