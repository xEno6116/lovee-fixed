import { createHash } from "crypto";
import type { Request } from "express";
import { readJson, updateJson } from "./githubStorage";

const SECURITY_DATA_PATH = "data/security.json";
const LOGIN_WINDOW_MS = 15 * 60 * 1_000;
const LOGIN_LOCK_MS = 15 * 60 * 1_000;
const MAX_FAILED_ATTEMPTS = 5;

type LoginRecord = { failedAt: number[]; lockedUntil?: number };
type SecurityEvent = { at: string; status: "success" | "failed" | "blocked" };
type SecurityRepository = { version: 1; loginRecords: Record<string, LoginRecord>; events: SecurityEvent[] };

function emptySecurityRepository(): SecurityRepository {
  return { version: 1, loginRecords: {}, events: [] };
}

function requestFingerprint(req: Request) {
  const forwarded = req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? req.ip ?? "unknown";
  const agent = req.header("user-agent") ?? "unknown";
  return createHash("sha256").update(`loveoffice-owner-login:${forwarded}:${agent}`).digest("hex").slice(0, 24);
}

function pushEvent(repository: SecurityRepository, status: SecurityEvent["status"], now: number) {
  repository.events = [{ at: new Date(now).toISOString(), status }, ...repository.events].slice(0, 80);
}

function pruneRecord(record: LoginRecord, now: number) {
  record.failedAt = record.failedAt.filter((at) => at > now - LOGIN_WINDOW_MS);
  if (record.lockedUntil && record.lockedUntil <= now) delete record.lockedUntil;
}

export type OwnerLoginAttempt = {
  allowed: boolean;
  locked: boolean;
  retryAfterSeconds: number;
};

/** Stores a short-lived, hashed device fingerprint only; raw addresses are never persisted. */
export async function recordOwnerLoginAttempt(req: Request, passcodeValid: boolean): Promise<OwnerLoginAttempt> {
  const fingerprint = requestFingerprint(req);
  return updateJson<SecurityRepository, OwnerLoginAttempt>(SECURITY_DATA_PATH, emptySecurityRepository, "loveoffice: owner login security event", (repository) => {
    const now = Date.now();
    const record = repository.loginRecords[fingerprint] ?? { failedAt: [] };
    pruneRecord(record, now);

    if (record.lockedUntil && record.lockedUntil > now) {
      repository.loginRecords[fingerprint] = record;
      pushEvent(repository, "blocked", now);
      return { data: repository, result: { allowed: false, locked: true, retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1_000) } };
    }

    if (passcodeValid) {
      delete repository.loginRecords[fingerprint];
      pushEvent(repository, "success", now);
      return { data: repository, result: { allowed: true, locked: false, retryAfterSeconds: 0 } };
    }

    record.failedAt.push(now);
    if (record.failedAt.length >= MAX_FAILED_ATTEMPTS) record.lockedUntil = now + LOGIN_LOCK_MS;
    repository.loginRecords[fingerprint] = record;
    pushEvent(repository, "failed", now);
    return {
      data: repository,
      result: {
        allowed: false,
        locked: Boolean(record.lockedUntil),
        retryAfterSeconds: record.lockedUntil ? Math.ceil((record.lockedUntil - now) / 1_000) : 0,
      },
    };
  });
}

export async function getOwnerSecurityOverview() {
  const { data } = await readJson(SECURITY_DATA_PATH, emptySecurityRepository);
  const now = Date.now();
  const activeLocks = Object.values(data.loginRecords).filter((record) => (record.lockedUntil ?? 0) > now).length;
  return {
    activeLocks,
    policy: { maxFailedAttempts: MAX_FAILED_ATTEMPTS, lockMinutes: LOGIN_LOCK_MS / 60_000, windowMinutes: LOGIN_WINDOW_MS / 60_000 },
    recentEvents: data.events.slice(0, 12),
  };
}
