import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dataLayer = readFileSync(new URL("../../server/db.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("../../server/routers/site.ts", import.meta.url), "utf8");
const home = readFileSync(new URL("./pages/Home.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("./pages/Settings.tsx", import.meta.url), "utf8");
const soundEffects = readFileSync(new URL("./soundEffects.ts", import.meta.url), "utf8");

describe("owner-controlled sound effects", () => {
  it("uses a safe default, validates the allowed volume range, and exposes controls in Settings", () => {
    expect(dataLayer).toContain("soundEffectsEnabled: true");
    expect(dataLayer).toContain("soundEffectsVolume: 0.35");
    expect(router).toContain("soundEffectsEnabled: z.boolean().default(true)");
    expect(router).toContain("soundEffectsVolume: z.number().min(0).max(1).default(0.35)");
    expect(settings).toContain("เสียงเอฟเฟกต์");
    expect(settings).toContain("ระดับเสียง:");
  });

  it("creates sound locally only after an enabled interaction and covers all supported delights", () => {
    expect(soundEffects).toContain("AudioContext");
    expect(soundEffects).toContain("no media file or network request is used");
    expect(home).toContain("if (features.soundEffectsEnabled) playEffectSound(effect, features.soundEffectsVolume)");
    expect(home).toContain("playSound(\"open\")");
    expect(home).toContain("playSound(\"heart\")");
    expect(home).toContain("playSound(\"flip\")");
    expect(home).toContain("playSound(\"puzzle\")");
    expect(home).toContain("playSound(\"gift\")");
    expect(home).toContain("playSound(\"secret\")");
  });
});
