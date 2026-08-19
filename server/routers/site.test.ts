import { describe, expect, it, vi } from "vitest";

const getPublicSiteData = vi.fn(async () => ({
  settings: {
    id: 42,
    startDate: "2024-04-06",
    memoryMessage: "เทส",
    musicUrl: "",
    birthdayGreeting: "Happy Birthday!",
    birthdayWishes: "เทส",
  },
  images: [],
  videos: [],
}));
const verifyPin = vi.fn(async (pin: string, id: number) => pin === "0000" && id === 42);
const updateSiteSettings = vi.fn(async (input: Record<string, unknown>) => ({ id: 42, ...input }));

vi.mock("../db", () => ({
  createMediaAsset: vi.fn(),
  deleteMediaAsset: vi.fn(),
  getAdminSiteData: vi.fn(),
  getPublicSiteData,
  listMediaAssets: vi.fn(),
  updateMediaOrder: vi.fn(),
  updateSiteSettings,
  verifyPin,
}));

const { siteRouter } = await import("./site");

describe("site router", () => {
  it("verifies the public PIN through the backend service", async () => {
    const caller = siteRouter.createCaller({ user: null } as never);
    await expect(caller.public.verifyPin({ pin: "0000" })).resolves.toEqual({ valid: true });
    await expect(caller.public.verifyPin({ pin: "1111" })).resolves.toEqual({ valid: false });
    expect(verifyPin).toHaveBeenLastCalledWith("1111", 42);
  });

  it("rejects Settings data for a non-owner account", async () => {
    const caller = siteRouter.createCaller({ user: { role: "user" } } as never);
    await expect(caller.admin.get()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows the owner to save Settings through the backend", async () => {
    const caller = siteRouter.createCaller({ user: { role: "admin" } } as never);
    const input = {
      memoryMessage: "บันทึกใหม่",
      startDate: "2024-04-06",
      pin: "0000",
      musicUrl: "",
      birthdayGreeting: "Happy Birthday!",
      birthdayWishes: "มีความสุขมาก ๆ",
    };
    await expect(caller.admin.saveSettings(input)).resolves.toMatchObject({ id: 42, memoryMessage: "บันทึกใหม่" });
    expect(updateSiteSettings).toHaveBeenCalledWith(input);
  });
});
