import { describe, expect, it, vi } from "vitest";

const ownedSite = { id: 9, ownerId: 1, slug: "main-memory", title: "เว็บไซต์ความทรงจำหลัก" };
const getOwnedSiteBySlug = vi.fn(async (ownerId: number, slug: string) => ownerId === 1 && slug === "main-memory" ? ownedSite : undefined);
const getPrivateSiteData = vi.fn(async (ownerId: number, slug: string) => ownerId === 1 && slug === "main-memory" ? ({ site: ownedSite, settings: { id: 42, startDate: "2024-04-06", memoryMessage: "เทส", musicUrl: "", facebookUrl: "", instagramUrl: "", themeColor: "#ec4899" }, images: [], videos: [] }) : undefined);
const getAdminSiteData = vi.fn(async (ownerId: number, slug: string) => ownerId === 1 && slug === "main-memory" ? ({ site: ownedSite, settings: { id: 42, siteId: 9, pinHash: "hash", startDate: "2024-04-06", memoryMessage: "เทส", musicUrl: "", facebookUrl: "", instagramUrl: "", themeColor: "#ec4899" }, assets: [] }) : undefined);
const verifySitePin = vi.fn(async (siteId: number, pin: string) => siteId === 9 && pin === "0000");
const updateSiteSettings = vi.fn(async (siteId: number, input: Record<string, unknown>) => ({ id: 42, siteId, ...input }));
const createSiteForOwner = vi.fn(async (ownerId: number, input: { title: string; slug: string }) => ({ id: 10, ownerId, ...input }));
const deleteSiteForOwner = vi.fn(async (ownerId: number, slug: string) => ({ success: ownerId === 1 && slug === "main-memory" }));

vi.mock("../db", () => ({
  createMediaAsset: vi.fn(),
  createSiteForOwner,
  deleteMediaAsset: vi.fn(),
  deleteSiteForOwner,
  getAdminSiteData,
  getOwnedSiteBySlug,
  getPrivateSiteData,
  listMediaAssets: vi.fn(async () => []),
  listSitesForOwner: vi.fn(async () => []),
  setMusicUrl: vi.fn(),
  updateMediaOrder: vi.fn(),
  updateSiteSettings,
  verifySitePin,
}));

const { siteRouter } = await import("./site");
const owner = { id: 1, role: "admin" };
const otherOwner = { id: 2, role: "user" };

describe("multi-site router", () => {
  it("allows an owner to unlock only their own site", async () => {
    const caller = siteRouter.createCaller({ user: owner } as never);
    await expect(caller.private.verifyPin({ slug: "main-memory", pin: "0000" })).resolves.toEqual({ valid: true });
    expect(verifySitePin).toHaveBeenCalledWith(9, "0000");
  });

  it("does not disclose sites to another authenticated owner", async () => {
    const caller = siteRouter.createCaller({ user: otherOwner } as never);
    await expect(caller.private.get({ slug: "main-memory" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.admin.get({ slug: "main-memory" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("creates a new site under the authenticated owner", async () => {
    const caller = siteRouter.createCaller({ user: otherOwner } as never);
    await expect(caller.dashboard.create({ title: "เว็บใหม่", slug: "new-memory" })).resolves.toMatchObject({ ownerId: 2, slug: "new-memory" });
    expect(createSiteForOwner).toHaveBeenCalledWith(2, { title: "เว็บใหม่", slug: "new-memory" });
  });

  it("saves settings only after resolving the site to its owner", async () => {
    const caller = siteRouter.createCaller({ user: owner } as never);
    const input = { slug: "main-memory", facebookUrl: "https://facebook.com/example", instagramUrl: "https://instagram.com/example", themeColor: "#2563eb" };
    await expect(caller.admin.saveSettings(input)).resolves.toMatchObject({ id: 42, siteId: 9, themeColor: "#2563eb" });
    expect(updateSiteSettings).toHaveBeenCalledWith(9, input);
  });

  it("rejects non-http social links before saving settings", async () => {
    const caller = siteRouter.createCaller({ user: owner } as never);
    await expect(caller.admin.saveSettings({ slug: "main-memory", facebookUrl: "javascript:alert(1)", instagramUrl: "", themeColor: "#ec4899" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("deletes only a site belonging to the authenticated owner", async () => {
    const ownerCaller = siteRouter.createCaller({ user: owner } as never);
    const otherCaller = siteRouter.createCaller({ user: otherOwner } as never);
    await expect(ownerCaller.dashboard.remove({ slug: "main-memory" })).resolves.toEqual({ success: true });
    await expect(otherCaller.dashboard.remove({ slug: "main-memory" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(deleteSiteForOwner).toHaveBeenCalledWith(1, "main-memory");
    expect(deleteSiteForOwner).toHaveBeenCalledWith(2, "main-memory");
  });
});
