import { describe, expect, it } from "vitest";
import { DEFAULT_PIN, decodeDataUrl, hashPin, isAllowedFont, isAllowedMedia, isValidPin, safeFileName } from "./siteUtils";

describe("site utilities", () => {
  it("accepts only a four-digit PIN and keeps the default PIN stable", () => {
    expect(DEFAULT_PIN).toBe("0000");
    expect(isValidPin("0000")).toBe(true);
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("12a4")).toBe(false);
    expect(isValidPin("123")).toBe(false);
    expect(hashPin("0000")).toHaveLength(64);
    expect(hashPin("0000")).not.toBe(hashPin("0001"));
  });

  it("decodes data URLs and validates media kinds", () => {
    const media = decodeDataUrl("data:image/png;base64,aGVsbG8=");
    expect(media.mimeType).toBe("image/png");
    expect(media.bytes.toString()).toBe("hello");
    expect(isAllowedMedia("image", media.mimeType)).toBe(true);
    expect(isAllowedMedia("video", media.mimeType)).toBe(false);
    expect(isAllowedMedia("audio", "audio/mpeg")).toBe(true);
    expect(() => decodeDataUrl("not-a-data-url")).toThrow("รูปแบบไฟล์ไม่ถูกต้อง");
  });

  it("normalizes filenames used in storage keys", () => {
    expect(safeFileName("ความทรงจำ ของเรา!.png")).toBe(".png");
    expect(safeFileName("hello world.mp4")).toBe("hello-world.mp4");
  });

  it("accepts supported font files only", () => {
    expect(isAllowedFont("memory.woff2", "font/woff2")).toBe(true);
    expect(isAllowedFont("memory.ttf", "application/octet-stream")).toBe(true);
    expect(isAllowedFont("memory.exe", "application/octet-stream")).toBe(false);
  });

});
