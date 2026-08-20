import { timingSafeEqual } from "crypto";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { recordOwnerLoginAttempt } from "../adminSecurity";

export const OWNER_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export function isOwnerPasscodeValid(passcode: unknown) {
  const configuredPasscode = process.env.OWNER_LOGIN_PASSWORD;
  if (typeof passcode !== "string" || !configuredPasscode || !/^\d{6,12}$/.test(passcode) || !/^\d{6,12}$/.test(configuredPasscode)) return false;
  const candidate = Buffer.from(passcode, "utf8");
  const expected = Buffer.from(configuredPasscode, "utf8");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function issueOwnerSession(req: Request, res: Response) {
  if (!ENV.ownerOpenId) throw new Error("owner login is not configured");
  const owner = await db.getUserByOpenId(ENV.ownerOpenId);
  if (!owner || owner.role !== "admin") throw new Error("owner account is not available");
  const sessionToken = await sdk.createSessionToken(owner.openId, { name: owner.name || "Owner", expiresInMs: OWNER_SESSION_MS });
  res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: OWNER_SESSION_MS });
  return { success: true } as const;
}

export async function validateOwnerPasscodeAttempt(req: Request, passcode: unknown) {
  return recordOwnerLoginAttempt(req, isOwnerPasscodeValid(passcode));
}

export function registerOwnerPasscodeAuthRoutes(app: Express) {
  app.post("/api/owner-auth/login", async (req: Request, res: Response) => {
    try {
      const attempt = await validateOwnerPasscodeAttempt(req, req.body?.passcode);
      if (!attempt.allowed) {
        const message = attempt.locked
          ? `ลองรหัสผิดหลายครั้ง ระบบล็อกชั่วคราว กรุณาลองใหม่ใน ${Math.max(1, Math.ceil(attempt.retryAfterSeconds / 60))} นาที`
          : "รหัสตัวเลขไม่ถูกต้อง";
        res.status(attempt.locked ? 429 : 401).json({ error: message });
        return;
      }
      res.status(200).json(await issueOwnerSession(req, res));
    } catch (error) {
      console.error("[OwnerAuth] Passcode login failed", error);
      res.status(500).json({ error: "ไม่สามารถเข้าสู่ระบบได้" });
    }
  });

  app.post("/api/owner-auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
    res.status(200).json({ success: true });
  });
}
