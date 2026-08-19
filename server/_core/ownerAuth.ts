import { timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

export function isOwnerPasswordValid(password: unknown) {
  const configuredPassword = process.env.OWNER_LOGIN_PASSWORD;
  if (typeof password !== "string" || !configuredPassword) return false;

  const candidate = Buffer.from(password, "utf8");
  const expected = Buffer.from(configuredPassword, "utf8");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function issueOwnerSession(req: Request, res: Response) {
  if (!ENV.ownerOpenId) {
    throw new Error("owner login is not configured");
  }

  const owner = await db.getUserByOpenId(ENV.ownerOpenId);
  if (!owner || owner.role !== "admin") {
    throw new Error("owner account is not available");
  }

  const sessionToken = await sdk.createSessionToken(owner.openId, {
    name: owner.name || "Owner",
    expiresInMs: ONE_YEAR_MS,
  });
  res.cookie(COOKIE_NAME, sessionToken, {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS,
  });
  return { success: true } as const;
}

export function registerOwnerPasswordAuthRoutes(app: Express) {
  app.post("/api/owner-auth/login", async (req: Request, res: Response) => {
    try {
      if (!isOwnerPasswordValid(req.body?.password)) {
        res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });
        return;
      }
      const result = await issueOwnerSession(req, res);
      res.status(200).json(result);
    } catch (error) {
      console.error("[OwnerAuth] Login failed", error);
      res.status(500).json({ error: "ไม่สามารถเข้าสู่ระบบได้" });
    }
  });

  app.post("/api/owner-auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
    res.status(200).json({ success: true });
  });
}
