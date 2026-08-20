import type { Express, Request, Response } from "express";
import { parse as parseCookie } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import { sendLoveOfficeEmail } from "../email";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

const MAGIC_LINK_TTL_SECONDS = 10 * 60;
const MAGIC_LINK_COOLDOWN_MS = 60 * 1000;
const MAGIC_LINK_COOKIE = "owner_magic_link_cooldown";
const MAGIC_LINK_ISSUER = "loveoffice";
const MAGIC_LINK_AUDIENCE = "owner-magic-link";
const OWNER_DASHBOARD_PATH = "/loveoffice-console-5h9q2x7m4k8v1r6d3";

function magicLinkSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("ยังไม่ได้ตั้งค่า JWT secret");
  return new TextEncoder().encode(secret);
}

export function getAllowedOwnerEmail() {
  return process.env.OWNER_ALLOWED_EMAIL?.trim().toLowerCase() ?? "";
}

function requestOrigin(req: Request) {
  if (process.env.NODE_ENV === "production") return "https://loveoffice-memory.vercel.app";
  return `${req.protocol || "http"}://${req.get("host") || "localhost:3000"}`;
}

function hasMagicLinkCooldown(req: Request) {
  return Boolean(parseCookie(req.header("cookie") ?? "")[MAGIC_LINK_COOKIE]);
}

export async function createOwnerMagicLinkToken(email: string) {
  const allowedEmail = getAllowedOwnerEmail();
  if (!allowedEmail || email.trim().toLowerCase() !== allowedEmail) throw new Error("อีเมลนี้ไม่ได้รับอนุญาต");
  return new SignJWT({ email: allowedEmail })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(MAGIC_LINK_ISSUER)
    .setAudience(MAGIC_LINK_AUDIENCE)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${MAGIC_LINK_TTL_SECONDS}s`)
    .sign(magicLinkSecret());
}

export async function verifyOwnerMagicLinkToken(token: string) {
  const { payload } = await jwtVerify(token, magicLinkSecret(), { issuer: MAGIC_LINK_ISSUER, audience: MAGIC_LINK_AUDIENCE });
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email || email !== getAllowedOwnerEmail()) throw new Error("ลิงก์นี้ไม่ได้รับอนุญาต");
  return email;
}

export async function requestOwnerMagicLink(req: Request, res: Response) {
  const allowedEmail = getAllowedOwnerEmail();
  if (!allowedEmail) throw new Error("ยังไม่ได้ตั้งค่าอีเมลเจ้าของ");
  if (hasMagicLinkCooldown(req)) return { success: true, cooldown: true } as const;
  const token = await createOwnerMagicLinkToken(allowedEmail);
  const link = `${requestOrigin(req)}/api/owner-auth/verify?token=${encodeURIComponent(token)}`;
  await sendLoveOfficeEmail({
    to: allowedEmail,
    subject: "ลิงก์เข้าสู่หลังบ้าน LoveOffice",
    message: `กดลิงก์นี้เพื่อเข้าสู่หลังบ้าน LoveOffice:\n${link}\n\nลิงก์นี้จะหมดอายุภายใน 10 นาที หากคุณไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลฉบับนี้ได้`,
  });
  res.cookie(MAGIC_LINK_COOKIE, "1", { ...getSessionCookieOptions(req), httpOnly: true, maxAge: MAGIC_LINK_COOLDOWN_MS });
  return { success: true, cooldown: false } as const;
}

export async function issueOwnerSession(req: Request, res: Response) {
  if (!ENV.ownerOpenId) throw new Error("owner login is not configured");
  const owner = await db.getUserByOpenId(ENV.ownerOpenId);
  if (!owner || owner.role !== "admin") throw new Error("owner account is not available");
  const sessionToken = await sdk.createSessionToken(owner.openId, { name: owner.name || "Owner", expiresInMs: ONE_YEAR_MS });
  res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
  return { success: true } as const;
}

export function registerOwnerEmailAuthRoutes(app: Express) {
  app.post("/api/owner-auth/request-link", async (req: Request, res: Response) => {
    try {
      const result = await requestOwnerMagicLink(req, res);
      res.status(200).json(result);
    } catch (error) {
      console.error("[OwnerAuth] Magic link request failed", error);
      res.status(500).json({ error: "ไม่สามารถส่งลิงก์เข้าสู่ระบบได้" });
    }
  });

  app.get("/api/owner-auth/verify", async (req: Request, res: Response) => {
    try {
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (!token) {
        res.status(400).send("ลิงก์เข้าสู่ระบบไม่ถูกต้อง");
        return;
      }
      await verifyOwnerMagicLinkToken(token);
      await issueOwnerSession(req, res);
      res.redirect(303, OWNER_DASHBOARD_PATH);
    } catch (error) {
      console.error("[OwnerAuth] Magic link verification failed", error);
      res.status(401).send("ลิงก์เข้าสู่ระบบไม่ถูกต้องหรือหมดอายุแล้ว");
    }
  });

  app.post("/api/owner-auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
    res.status(200).json({ success: true });
  });
}
