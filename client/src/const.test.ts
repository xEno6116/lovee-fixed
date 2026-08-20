import { describe, expect, it } from "vitest";
import { OWNER_DASHBOARD_PATH, ownerSettingsPath } from "./const";

describe("owner dashboard route", () => {
  it("uses the new non-public LoveOffice route for dashboard settings", () => {
    expect(OWNER_DASHBOARD_PATH).toBe("/loveoffice-console-5h9q2x7m4k8v1r6d3");
    expect(OWNER_DASHBOARD_PATH).not.toContain("owner-portal");
    expect(ownerSettingsPath("main-memory")).toBe(
      "/loveoffice-console-5h9q2x7m4k8v1r6d3/site/main-memory/settings"
    );
  });
});
