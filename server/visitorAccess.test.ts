import { describe, expect, it } from "vitest";
import { createLetterSubmissionToken, createVisitorAccessToken, getVisitorSiteId, hasSubmittedLetter, LETTER_SUBMISSION_COOKIE, VISITOR_ACCESS_COOKIE } from "./visitorAccess";

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

  it("locks letter submission only for the signed site that already received a response", async () => {
    const token = await createLetterSubmissionToken(42);
    const request = { headers: { cookie: `${LETTER_SUBMISSION_COOKIE}=${token}` } } as never;
    await expect(hasSubmittedLetter(request, 42)).resolves.toBe(true);
    await expect(hasSubmittedLetter(request, 43)).resolves.toBe(false);
  });
});
