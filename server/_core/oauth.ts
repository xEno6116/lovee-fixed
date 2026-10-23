import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}
function hashPassword(password: string, salt = randomBytes(16).toString("hex")) { return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`; }
function verifyPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
function readCredentials(req: Request) {
  return { email: typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "", password: typeof req.body?.password === "string" ? req.body.password : "" };
}
function validateCredentials(email: string, password: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "กรุณากรอกอีเมลให้ถูกต้อง";
  if (password.length < 8) return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
  return null;
}
async function createLocalSession(req: Request, res: Response, user: { openId: string; name: string | null }) {
  const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: ONE_YEAR_MS });
  res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
  res.json({ ok: true });
}

export function registerOAuthRoutes(app: Express) {
  app.post("/api/local-register", async (req: Request, res: Response) => {
    const { email, password } = readCredentials(req);
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const validationError = validateCredentials(email, password);
    if (validationError) { res.status(400).json({ error: validationError }); return; }
    if (name.length < 2 || name.length > 80) { res.status(400).json({ error: "กรุณากรอกชื่อ 2-80 ตัวอักษร" }); return; }
    try {
      const user = await db.createLocalUser({ email, name, passwordHash: hashPassword(password) });
      await createLocalSession(req, res, user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "สมัครสมาชิกไม่สำเร็จ";
      res.status(message.includes("มีบัญชี") ? 409 : 500).json({ error: message });
    }
  });

  app.post("/api/local-login", async (req: Request, res: Response) => {
    const { email, password } = readCredentials(req);
    if (!email || !password) { res.status(400).json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" }); return; }
    const user = await db.getLocalUserByEmail(email);
    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) { res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }); return; }
    await createLocalSession(req, res, user);
  });

  app.post("/api/owner-login", async (req: Request, res: Response) => {
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const expected = ENV.ownerLoginPassword;
    const matches = Boolean(expected && password && password.length === expected.length) ? timingSafeEqual(Buffer.from(password), Buffer.from(expected)) : false;
    if (!expected) { res.status(503).json({ error: "ยังไม่ได้ตั้งค่ารหัสเจ้าของบน Vercel" }); return; }
    if (!ENV.ownerOpenId) { res.status(503).json({ error: "ระบบยังไม่ได้ตั้งค่า OWNER_OPEN_ID บน Vercel" }); return; }
    if (!matches) { res.status(401).json({ error: "รหัสเจ้าของไม่ถูกต้อง" }); return; }
    try {
      await db.upsertUser({ openId: ENV.ownerOpenId, name: ENV.ownerName, loginMethod: "owner-password", lastSignedIn: new Date() });
      const sessionToken = await sdk.createSessionToken(ENV.ownerOpenId, { name: ENV.ownerName, expiresInMs: ONE_YEAR_MS });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.json({ ok: true });
    } catch (error) { console.error("[OwnerLogin] Failed", error); res.status(500).json({ error: "ไม่สามารถเข้าสู่ระบบได้" }); }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) { res.status(400).json({ error: "code and state are required" }); return; }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) { res.status(403).json({ error: "invalid oauth state" }); return; }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) { res.status(400).json({ error: "openId missing from user info" }); return; }
      await db.upsertUser({ openId: userInfo.openId, name: userInfo.name || null, email: userInfo.email ?? null, loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null, lastSignedIn: new Date() });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, { name: userInfo.name || "", expiresInMs: ONE_YEAR_MS });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) { console.error("[OAuth] Callback failed", error); res.status(500).json({ error: "OAuth callback failed" }); }
  });
}
