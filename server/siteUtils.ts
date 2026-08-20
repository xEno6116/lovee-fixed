import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

export const DEFAULT_PIN = "0000";

export function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

export function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin);
}

export function safeFileName(name: string) {
  const normalized = name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-");
  return normalized.replace(/-+/g, "-").replace(/^-|-$/g, "") || "upload";
}

export function decodeDataUrl(dataUrl: string) {
  const matched = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!matched) throw new Error("รูปแบบไฟล์ไม่ถูกต้อง");

  const [, mimeType, encoded] = matched;
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length) throw new Error("ไม่พบข้อมูลไฟล์");
  return { mimeType, bytes };
}

export function isAllowedMedia(kind: "image" | "video" | "audio", mimeType: string) {
  if (kind === "image") return mimeType.startsWith("image/");
  if (kind === "video") return mimeType.startsWith("video/");
  return mimeType.startsWith("audio/");
}

export function isAllowedFont(fileName: string, mimeType: string) {
  const extension = fileName.toLowerCase().match(/\.(woff2?|ttf|otf)$/)?.[1];
  return Boolean(extension) && (mimeType.startsWith("font/") || mimeType === "application/font-sfnt" || mimeType === "application/vnd.ms-fontobject" || mimeType === "application/octet-stream");
}
