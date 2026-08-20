import { describe, expect, it } from "vitest";
import { createVisitorAccessToken, getVisitorSiteId, VISITOR_ACCESS_COOKIE } from "./visitorAccess";

describe("visitor access cookie", () => {
  it("allows only a signed token with the public-site scope", async () => {
    const token = await createVisitorAccessToken(42);
    const request = { headers: { cookie: `${VISITOR_ACCESS_COOKIE}=${token}` } } as never;
    await expect(getVisitorSiteId(request)).resolves.toBe(42);
  });

  it("rejects an unsigned visitor cookie", async () => {
    const request = { headers: { cookie: `${VISITOR_ACCESS_COOKIE}=not-a-token` } } as never;
    await expect(getVisitorSiteId(request)).resolves.toBeNull();
  });
});
