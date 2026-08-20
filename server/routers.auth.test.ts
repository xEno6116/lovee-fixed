import { describe, expect, it } from "vitest";
import { ownerPasscodeInput } from "./routers";

describe("owner login input compatibility", () => {
  it("normalizes passcode sent by the current login form", () => {
    expect(ownerPasscodeInput.parse({ passcode: "100727" })).toEqual({ passcode: "100727" });
  });

  it("accepts the prior numeric password field without exposing a schema undefined error", () => {
    expect(ownerPasscodeInput.parse({ password: "100727" })).toEqual({ passcode: "100727" });
    expect(() => ownerPasscodeInput.parse(undefined)).toThrow("กรุณากรอกรหัสตัวเลข");
  });
});
