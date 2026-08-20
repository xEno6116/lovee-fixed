import { describe, expect, it } from "vitest";
import { isValidOwnerSessionPayload } from "./sdk";

describe("owner session payload validation", () => {
  it("accepts an owner-password session without an OAuth appId", () => {
    expect(isValidOwnerSessionPayload({ openId: "owner-1", appId: "", name: "Owner" })).toBe(true);
  });

  it("requires an owner identity and display name", () => {
    expect(isValidOwnerSessionPayload({ openId: "", appId: "app", name: "Owner" })).toBe(false);
    expect(isValidOwnerSessionPayload({ openId: "owner-1", appId: "app", name: "" })).toBe(false);
  });
});
