import { beforeEach, describe, expect, it, vi } from "vitest";

let storedData: unknown;

vi.mock("./githubStorage", () => ({
  readJson: async (_path: string, makeDefault: () => unknown) => ({ data: storedData ?? makeDefault() }),
  updateJson: async (_path: string, makeDefault: () => unknown, _message: string, mutate: (current: unknown) => Promise<{ data: unknown; result: unknown }> | { data: unknown; result: unknown }) => {
    const updated = await mutate(structuredClone(storedData ?? makeDefault()));
    storedData = updated.data;
    return updated.result;
  },
}));

const { getOwnerSecurityOverview, recordOwnerLoginAttempt } = await import("./adminSecurity");

const request = {
  ip: "203.0.113.27",
  header: (name: string) => name === "user-agent" ? "LoveOffice Test Browser" : undefined,
} as never;

describe("owner login security", () => {
  beforeEach(() => {
    storedData = undefined;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T08:00:00.000Z"));
  });

  it("locks the hashed browser fingerprint after five failed owner passcode attempts", async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(recordOwnerLoginAttempt(request, false)).resolves.toMatchObject({ allowed: false, locked: false });
    }
    await expect(recordOwnerLoginAttempt(request, false)).resolves.toMatchObject({ allowed: false, locked: true, retryAfterSeconds: 900 });
    await expect(recordOwnerLoginAttempt(request, true)).resolves.toMatchObject({ allowed: false, locked: true });
    expect(JSON.stringify(storedData)).not.toContain("203.0.113.27");
  });

  it("allows a correct passcode again after the lock expires and summarizes safe event data", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) await recordOwnerLoginAttempt(request, false);
    vi.advanceTimersByTime(15 * 60 * 1_000 + 1);
    await expect(recordOwnerLoginAttempt(request, true)).resolves.toEqual({ allowed: true, locked: false, retryAfterSeconds: 0 });
    const overview = await getOwnerSecurityOverview();
    expect(overview).toMatchObject({ activeLocks: 0, policy: { maxFailedAttempts: 5, lockMinutes: 15 } });
    expect(overview.recentEvents[0]).toMatchObject({ status: "success" });
  });
});
