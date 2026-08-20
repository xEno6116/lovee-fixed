import { createServer } from "http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "@shared/const";
import { createApp } from "./app";
import { isOwnerPasscodeValid, OWNER_SESSION_MS } from "./ownerAuth";

const TEST_OWNER_PASSCODE = "100727";

describe("owner weekly numeric passcode login", () => {
  let server: ReturnType<typeof createServer> | undefined;

  beforeEach(() => vi.stubEnv("OWNER_LOGIN_PASSWORD", TEST_OWNER_PASSCODE));
  afterEach(async () => {
    vi.unstubAllEnvs();
    if (!server) return;
    await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
    server = undefined;
  });

  it("accepts the configured numeric passcode and creates a seven-day httpOnly session", async () => {
    server = createServer(createApp());
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("ไม่สามารถเปิด test server ได้");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/owner-auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: TEST_OWNER_PASSCODE }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(response.headers.get("set-cookie")).toContain(`${COOKIE_NAME}=`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain(`Max-Age=${OWNER_SESSION_MS / 1000}`);
  });

  it("rejects incorrect or non-numeric passcodes without a session cookie", async () => {
    expect(isOwnerPasscodeValid("100728")).toBe(false);
    expect(isOwnerPasscodeValid("abcdef")).toBe(false);
    server = createServer(createApp());
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("ไม่สามารถเปิด test server ได้");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/owner-auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: "100728" }) });
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
