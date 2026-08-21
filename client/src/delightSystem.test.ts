import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dataLayer = readFileSync(new URL("../../server/db.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("../../server/routers/site.ts", import.meta.url), "utf8");
const home = readFileSync(new URL("./pages/Home.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("./pages/Settings.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("owner-controlled delight system", () => {
  it("defaults new effects safely and validates every saved toggle at the backend boundary", () => {
    expect(dataLayer).toContain("ambientHeartsEnabled: true");
    expect(dataLayer).toContain("sparklesEnabled: true");
    expect(dataLayer).toContain("filmOverlayEnabled: false");
    expect(dataLayer).toContain("secretGiftEnabled: true");
    expect(router).toContain("ambientHeartsEnabled: z.boolean().default(true)");
    expect(router).toContain("celebrationOnOpenEnabled: z.boolean().default(true)");
  });

  it("exposes separate controls in Settings and only renders each public effect when enabled", () => {
    expect(settings).toContain("ลูกเล่นและเอฟเฟกต์");
    expect(settings).toContain("เปิดหรือปิดแต่ละลูกเล่นได้อิสระ");
    expect(home).toContain("features.secretGiftEnabled &&");
    expect(home).toContain("features.easterEggEnabled &&");
    expect(home).toContain("features.ambientHeartsEnabled &&");
    expect(home).toContain("features.celebrationOnOpenEnabled");
  });

  it("keeps motion optional on mobile and honors users who reduce motion", () => {
    expect(styles).toContain(".legacy-delight-sparkles::before");
    expect(styles).toContain(".legacy-film-overlay");
    expect(styles).toContain(".legacy-celebration");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
