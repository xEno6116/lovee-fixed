import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { createOwnerMagicLinkToken, verifyOwnerMagicLinkToken } from "./ownerAuth";

const TEST_OWNER_EMAIL = "x8951309@gmail.com";
const nativeFetch = globalThis.fetch;

describe("owner email-only login", () => {
  let server: ReturnType<typeof createServer> | undefined;

  beforeEach(() => {
    vi.stubEnv("OWNER_ALLOWED_EMAIL", TEST_OWNER_EMAIL);
    vi.stubEnv("JWT_SECRET", "test-owner-magic-link-secret");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "email_123" }), { status: 200 })));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    if (!server) return;
    await new Promise<void>((resolve, reject) => server?.close((error) => (error ? reject(error) : resolve())));
    server = undefined;
  });

  it("sends a magic link only to the configured owner email", async () => {
    server = createServer(createApp());
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("ไม่สามารถเปิด test server ได้");

    const response = await nativeFetch(`http://127.0.0.1:${address.port}/api/owner-auth/request-link`, {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, cooldown: false });
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ body: expect.stringContaining(TEST_OWNER_EMAIL) }));
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("removes the former password login endpoint", async () => {
    server = createServer(createApp());
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("ไม่สามารถเปิด test server ได้");

    const response = await nativeFetch(`http://127.0.0.1:${address.port}/api/owner-auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects magic links that do not belong to the configured owner email", async () => {
    await expect(createOwnerMagicLinkToken("other@example.com")).rejects.toThrow("อีเมลนี้ไม่ได้รับอนุญาต");
    const token = await createOwnerMagicLinkToken(TEST_OWNER_EMAIL);
    await expect(verifyOwnerMagicLinkToken(token)).resolves.toBe(TEST_OWNER_EMAIL);
    vi.stubEnv("OWNER_ALLOWED_EMAIL", "different-owner@example.com");
    await expect(verifyOwnerMagicLinkToken(token)).rejects.toThrow("ลิงก์นี้ไม่ได้รับอนุญาต");
  });
});
