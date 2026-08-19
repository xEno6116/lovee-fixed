import { asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import { mediaAssets, siteSettings, type InsertUser, users } from "../drizzle/schema";
import { DEFAULT_PIN, hashPin, safeFileName } from "./siteUtils";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    _db = drizzle(process.env.DATABASE_URL);
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลได้");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await requireDb();
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await requireDb();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getOrCreateSiteSettings() {
  const db = await requireDb();
  const existing = await db.select().from(siteSettings).limit(1);
  if (existing[0]) return existing[0];

  await db.insert(siteSettings).values({
    pinHash: hashPin(DEFAULT_PIN),
    startDate: "2024-04-06",
    memoryMessage: "บันทึกความทรงจำของเรา",
    musicUrl: "",
    birthdayGreeting: "Happy Birthday!",
    birthdayWishes: "ขอให้ทุกวันเต็มไปด้วยรอยยิ้มและความสุข",
  });
  const created = await db.select().from(siteSettings).limit(1);
  if (!created[0]) throw new Error("ไม่สามารถสร้างการตั้งค่าเริ่มต้นได้");
  return created[0];
}

export async function listMediaAssets(kind?: "image" | "video" | "audio") {
  const db = await requireDb();
  const query = db.select().from(mediaAssets);
  const rows = kind ? await query.where(eq(mediaAssets.kind, kind)).orderBy(asc(mediaAssets.sortOrder), asc(mediaAssets.id)) : await query.orderBy(asc(mediaAssets.kind), asc(mediaAssets.sortOrder), asc(mediaAssets.id));
  return rows;
}

export async function getPublicSiteData() {
  const settings = await getOrCreateSiteSettings();
  const assets = await listMediaAssets();
  return {
    settings: {
      id: settings.id,
      startDate: settings.startDate,
      memoryMessage: settings.memoryMessage,
      musicUrl: settings.musicUrl,
      birthdayGreeting: settings.birthdayGreeting,
      birthdayWishes: settings.birthdayWishes,
    },
    images: assets.filter((asset) => asset.kind === "image"),
    videos: assets.filter((asset) => asset.kind === "video"),
  };
}

export async function getAdminSiteData() {
  const settings = await getOrCreateSiteSettings();
  const assets = await listMediaAssets();
  return { settings, assets };
}

export async function verifyPin(pin: string, settingsId?: number) {
  const db = await requireDb();
  const settings = settingsId ? (await db.select().from(siteSettings).where(eq(siteSettings.id, settingsId)).limit(1))[0] : await getOrCreateSiteSettings();
  return Boolean(settings && settings.pinHash === hashPin(pin));
}

export async function updateSiteSettings(input: {
  memoryMessage: string;
  startDate: string;
  pin?: string;
  musicUrl: string;
  birthdayGreeting: string;
  birthdayWishes: string;
}) {
  const db = await requireDb();
  const current = await getOrCreateSiteSettings();
  await db.update(siteSettings).set({
    memoryMessage: input.memoryMessage,
    startDate: input.startDate,
    musicUrl: input.musicUrl,
    birthdayGreeting: input.birthdayGreeting,
    birthdayWishes: input.birthdayWishes,
    ...(input.pin ? { pinHash: hashPin(input.pin) } : {}),
  }).where(eq(siteSettings.id, current.id));
  return getOrCreateSiteSettings();
}

export async function setMusicUrl(musicUrl: string) {
  const db = await requireDb();
  const current = await getOrCreateSiteSettings();
  await db.update(siteSettings).set({ musicUrl }).where(eq(siteSettings.id, current.id));
  return getOrCreateSiteSettings();
}

export async function createMediaAsset(input: {
  kind: "image" | "video" | "audio";
  originalName: string;
  mimeType: string;
  bytes: Buffer;
}) {
  const db = await requireDb();
  const current = await listMediaAssets(input.kind);
  const nextOrder = (current.at(-1)?.sortOrder ?? -1) + 1;
  const fileName = safeFileName(input.originalName);
  const storageKey = `anniversary/${input.kind}/${Date.now()}-${nanoid(10)}-${fileName}`;
  const uploaded = await storagePut(storageKey, input.bytes, input.mimeType);
  await db.insert(mediaAssets).values({
    kind: input.kind,
    storageKey: uploaded.key,
    url: uploaded.url,
    originalName: input.originalName,
    mimeType: input.mimeType,
    sortOrder: nextOrder,
  });
  const created = await db.select().from(mediaAssets).orderBy(desc(mediaAssets.id)).limit(1);
  if (!created[0]) throw new Error("ไม่สามารถบันทึกข้อมูลไฟล์ได้");
  return created[0];
}

export async function deleteMediaAsset(id: number) {
  const db = await requireDb();
  await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  return { success: true };
}

export async function updateMediaOrder(id: number, sortOrder: number) {
  const db = await requireDb();
  await db.update(mediaAssets).set({ sortOrder }).where(eq(mediaAssets.id, id));
  return { success: true };
}
