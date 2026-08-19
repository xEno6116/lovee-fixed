import type { Request } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { getUserByOpenId } from "./db";
import { siteRouter } from "./routers/site";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME } from "../shared/const";

describe("private GitHub user identity integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores the migrated OAuth owner with its stable id and role", async () => {
    const user = await getUserByOpenId("ewDJRZxddMirGiygQskmrQ");

    expect(user).toMatchObject({
      id: 1,
      openId: "ewDJRZxddMirGiygQskmrQ",
      name: "Xixix",
      email: "x8951309@gmail.com",
      loginMethod: "google",
      role: "admin",
    });
    expect(user?.createdAt).toBeInstanceOf(Date);
    expect(user?.lastSignedIn).toBeInstanceOf(Date);
  });

  it("uses the GitHub-backed owner identity to authorize a protected site route", async () => {
    const user = await getUserByOpenId("ewDJRZxddMirGiygQskmrQ");
    if (!user) throw new Error("ไม่พบ user owner ที่ย้ายแล้ว");

    const caller = siteRouter.createCaller({ user } as never);
    await expect(caller.private.get({ slug: "main-memory" })).resolves.toMatchObject({
      site: { id: 1, ownerId: 1, slug: "main-memory" },
      settings: { memoryMessage: "บันทึกความทรงจำของเรา" },
    });
  });

  it("authenticates a signed session through the SDK using the GitHub-backed owner identity", async () => {
    const touchUser = vi.spyOn(db, "upsertUser").mockResolvedValue();
    const session = await sdk.createSessionToken("ewDJRZxddMirGiygQskmrQ", { name: "Xixix" });
    const request = { headers: { cookie: `${COOKIE_NAME}=${session}` } } as Request;

    await expect(sdk.authenticateRequest(request)).resolves.toMatchObject({
      id: 1,
      openId: "ewDJRZxddMirGiygQskmrQ",
      role: "admin",
    });
    expect(touchUser).toHaveBeenCalledWith(expect.objectContaining({ openId: "ewDJRZxddMirGiygQskmrQ" }));
  });
});
