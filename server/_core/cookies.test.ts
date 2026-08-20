import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./cookies";

describe("getSessionCookieOptions", () => {
  it("uses a Secure cookie on public hosts even when Express sees an internal protocol", () => {
    const options = getSessionCookieOptions({
      hostname: "lovee-backoffice-pewnalw4k-lovee-xeno.vercel.app",
      protocol: "http",
      headers: {},
    } as any);

    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("none");
  });

  it("keeps local development cookies non-secure", () => {
    const options = getSessionCookieOptions({
      hostname: "localhost",
      protocol: "http",
      headers: {},
    } as any);

    expect(options.secure).toBe(false);
  });
});
