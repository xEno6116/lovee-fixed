import { describe, expect, it } from "vitest";
import { getPrivateSiteData, listSitesForOwner, verifySitePin } from "./db";

describe("private GitHub data repository integration", () => {
  it("returns the migrated site only to its owning account", async () => {
    await expect(getPrivateSiteData(1, "main-memory")).resolves.toMatchObject({
      site: { id: 1, ownerId: 1, slug: "main-memory", title: "เว็บไซต์ความทรงจำหลัก" },
      settings: { startDate: "2024-04-06", memoryMessage: "บันทึกความทรงจำของเรา", musicUrl: "" },
      images: [],
      videos: [],
    });
    await expect(getPrivateSiteData(2, "main-memory")).resolves.toBeUndefined();
  });

  it("preserves the configured default PIN hash without returning it to the client", async () => {
    await expect(verifySitePin(1, "0000")).resolves.toBe(true);
  });

  it("removes repository-only settings and storage keys from every browser response", async () => {
    const privateData = await getPrivateSiteData(1, "main-memory");
    const dashboardSites = await listSitesForOwner(1);

    expect(privateData?.site).not.toHaveProperty("settings");
    expect(privateData?.site).not.toHaveProperty("assets");
    expect(privateData?.settings).not.toHaveProperty("pinHash");
    expect(dashboardSites[0]).not.toHaveProperty("settings");
    expect(dashboardSites[0]).not.toHaveProperty("assets");
    expect(JSON.stringify({ privateData, dashboardSites })).not.toContain("9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0");
  });
});
