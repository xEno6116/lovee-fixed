import { afterEach, describe, expect, it } from "vitest";
import { inspectLetterResponse, recordLetterResponse, resetLetterResponseGuard } from "./letterResponse";

afterEach(resetLetterResponseGuard);

describe("letter response guard", () => {
  it("rejects bots and forms submitted too quickly", () => {
    expect(inspectLetterResponse({ startedAt: 9_500, honeypot: "bot" }, "visitor", 12_000)).toMatchObject({ allowed: false, silent: true });
    expect(inspectLetterResponse({ startedAt: 11_000 }, "visitor", 12_000)).toMatchObject({ allowed: false, silent: false });
  });

  it("limits a visitor to one response per minute", () => {
    expect(inspectLetterResponse({ startedAt: 0 }, "visitor", 3_000).allowed).toBe(true);
    recordLetterResponse("visitor", 3_000);
    expect(inspectLetterResponse({ startedAt: 0 }, "visitor", 4_000)).toMatchObject({ allowed: false, reason: expect.stringContaining("อีกสักครู่") });
  });
});
