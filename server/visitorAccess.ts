import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";

export const VISITOR_ACCESS_COOKIE = "loveoffice_site_access";
export const LETTER_SUBMISSION_COOKIE = "loveoffice_letter_submitted";
const VISITOR_ACCESS_MS = 24 * 60 * 60 * 1_000;
const LETTER_SUBMISSION_MS = 365 * 24 * 60 * 60 * 1_000;

function secret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function createVisitorAccessToken(siteId: number, now = Date.now()) {
  return new SignJWT({ siteId, scope: "public-site" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor((now + VISITOR_ACCESS_MS) / 1_000))
    .sign(secret());
}

export async function createLetterSubmissionToken(siteId: number, now = Date.now()) {
  return new SignJWT({ siteId, scope: "letter-submitted" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor((now + LETTER_SUBMISSION_MS) / 1_000))
    .sign(secret());
}

export async function getVisitorSiteId(req: Request): Promise<number | null> {
  const token = parseCookieHeader(req.headers.cookie ?? "")[VISITOR_ACCESS_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.scope === "public-site" && typeof payload.siteId === "number" && Number.isInteger(payload.siteId) ? payload.siteId : null;
  } catch {
    return null;
  }
}

export async function hasSubmittedLetter(req: Request, siteId: number): Promise<boolean> {
  const token = parseCookieHeader(req.headers.cookie ?? "")[LETTER_SUBMISSION_COOKIE];
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.scope === "letter-submitted" && payload.siteId === siteId;
  } catch {
    return false;
  }
}

export const visitorAccessMaxAgeSeconds = Math.floor(VISITOR_ACCESS_MS / 1_000);
export const letterSubmissionMaxAgeSeconds = Math.floor(LETTER_SUBMISSION_MS / 1_000);
