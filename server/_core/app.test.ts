import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import vercelHandler from "./vercelEntry";

describe("shared Express app factory", () => {
  let server: ReturnType<typeof createServer> | undefined;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => server?.close((error) => (error ? reject(error) : resolve())));
    server = undefined;
  });

  it("creates a handler that serves API routes without starting its own listener", async () => {
    server = createServer(createApp());
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("ไม่สามารถเปิด test server ได้");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/not-found`);
    expect(response.status).toBe(404);
  });

  it("exports the same handler through the Vercel catch-all API entry point", async () => {
    server = createServer(vercelHandler);
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("ไม่สามารถเปิด test server ได้");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/trpc/not-a-procedure`);
    expect(response.status).toBe(404);
  });

  it("dispatches a public tRPC request through the Vercel serverless entry point", async () => {
    server = createServer(vercelHandler);
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("ไม่สามารถเปิด test server ได้");

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/trpc/auth.me?batch=1&input=${encodeURIComponent(JSON.stringify({ 0: { json: null } }))}`,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ result: expect.any(Object) }),
    ]));
  });

  it("keeps the OAuth callback path on the serverless handler instead of serving the SPA", async () => {
    server = createServer(vercelHandler);
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("ไม่สามารถเปิด test server ได้");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/oauth/callback`);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "code and state are required" });
  });
});
