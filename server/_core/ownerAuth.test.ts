import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "@shared/const";
import { createApp } from "./app";

const TEST_OWNER_PASSWORD = "owner-password-for-vitest";

describe("owner password login", () => {
  let server: ReturnType<typeof createServer> | undefined;

  beforeEach(() => {
    vi.stubEnv("OWNER_LOGIN_PASSWORD", TEST_OWNER_PASSWORD);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (!server) return;
    await new Promise<void>((resolve, reject) => server?.close((error) => (error ? reject(error) : resolve())));
    server = undefined;
  });

  it("accepts the configured owner secret and returns an httpOnly signed session cookie", async () => {
    server = createServer(createApp());
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("ไม่สามารถเปิด test server ได้");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/owner-auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: TEST_OWNER_PASSWORD }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(response.headers.get("set-cookie")).toContain(`${COOKIE_NAME}=`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("rejects an incorrect password without issuing a session cookie", async () => {
    server = createServer(createApp());
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("ไม่สามารถเปิด test server ได้");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/owner-auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "incorrect" }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
