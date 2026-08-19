import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import { anniversarySites, mediaAssets, siteSettings, type InsertUser, users } from "../drizzle/schema";
import { DEFAULT_PIN, hashPin, safeFileName } from "./siteUtils";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";

type MediaKind = "image" | "video" | "audio";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) _db = drizzle(process.env.DATABASE_URL);
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
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export async function listSitesForOwner(ownerId: number) {
  const db = await requireDb();
  return db.select().from(anniversarySites).where(eq(anniversarySites.ownerId, ownerId)).orderBy(desc(anniversarySites.updatedAt), desc(anniversarySites.id));
}

export async function getOwnedSiteBySlug(ownerId: number, slug: string) {
  const db = await requireDb();
  return (await db.select().from(anniversarySites).where(and(eq(anniversarySites.ownerId, ownerId), eq(anniversarySites.slug, slug))).limit(1))[0];
}

export async function createSiteForOwner(ownerId: number, input: { title: string; slug: string }) {
  const db = await requireDb();
  await db.insert(anniversarySites).values({ ownerId, title: input.title, slug: input.slug });
  const site = await getOwnedSiteBySlug(ownerId, input.slug);
  if (!site) throw new Error("ไม่สามารถสร้างเว็บไซต์ใหม่ได้");
  await db.insert(siteSettings).values({
    siteId: site.id,
    pinHash: hashPin(DEFAULT_PIN),
    startDate: "2024-04-06",
    memoryMessage: "บันทึกความทรงจำของเรา",
    musicUrl: "",
  });
  return site;
}

export async function deleteSiteForOwner(ownerId: number, slug: string) {
  const db = await requireDb();
  const site = await getOwnedSiteBySlug(ownerId, slug);
  if (!site) return { success: false };
  await db.delete(mediaAssets).where(eq(mediaAssets.siteId, site.id));
  await db.delete(siteSettings).where(eq(siteSettings.siteId, site.id));
  await db.delete(anniversarySites).where(and(eq(anniversarySites.id, site.id), eq(anniversarySites.ownerId, ownerId)));
  return { success: true };
}

export async function getSiteSettings(siteId: number) {
  const db = await requireDb();
  return (await db.select().from(siteSettings).where(eq(siteSettings.siteId, siteId)).limit(1))[0];
}

export async function listMediaAssets(siteId: number, kind?: MediaKind) {
  const db = await requireDb();
  const where = kind ? and(eq(mediaAssets.siteId, siteId), eq(mediaAssets.kind, kind)) : eq(mediaAssets.siteId, siteId);
  return db.select().from(mediaAssets).where(where).orderBy(asc(mediaAssets.kind), asc(mediaAssets.sortOrder), asc(mediaAssets.id));
}

export async function getPrivateSiteData(ownerId: number, slug: string) {
  const site = await getOwnedSiteBySlug(ownerId, slug);
  if (!site) return undefined;
  const settings = await getSiteSettings(site.id);
  if (!settings) throw new Error("ไม่พบข้อมูลการตั้งค่าเว็บไซต์");
  const assets = await listMediaAssets(site.id);
  return {
    site,
    settings: {
      id: settings.id,
      startDate: settings.startDate,
      memoryMessage: settings.memoryMessage,
      musicUrl: settings.musicUrl,
    },
    images: assets.filter((asset) => asset.kind === "image"),
    videos: assets.filter((asset) => asset.kind === "video"),
  };
}

export async function getAdminSiteData(ownerId: number, slug: string) {
  const site = await getOwnedSiteBySlug(ownerId, slug);
  if (!site) return undefined;
  const settings = await getSiteSettings(site.id);
  if (!settings) throw new Error("ไม่พบข้อมูลการตั้งค่าเว็บไซต์");
  const assets = await listMediaAssets(site.id);
  return { site, settings, assets };
}

export async function verifySitePin(siteId: number, pin: string) {
  const settings = await getSiteSettings(siteId);
  return Boolean(settings && settings.pinHash === hashPin(pin));
}

export async function updateSiteSettings(siteId: number, input: { memoryMessage: string; startDate: string; pin?: string; musicUrl: string }) {
  const db = await requireDb();
  await db.update(siteSettings).set({
    memoryMessage: input.memoryMessage,
    startDate: input.startDate,
    musicUrl: input.musicUrl,
    ...(input.pin ? { pinHash: hashPin(input.pin) } : {}),
  }).where(eq(siteSettings.siteId, siteId));
  const settings = await getSiteSettings(siteId);
  if (!settings) throw new Error("ไม่สามารถบันทึกการตั้งค่าได้");
  return settings;
}

export async function setMusicUrl(siteId: number, musicUrl: string) {
  const db = await requireDb();
  await db.update(siteSettings).set({ musicUrl }).where(eq(siteSettings.siteId, siteId));
}

export async function createMediaAsset(siteId: number, input: { kind: MediaKind; originalName: string; mimeType: string; bytes: Buffer }) {
  const db = await requireDb();
  const current = await listMediaAssets(siteId, input.kind);
  const nextOrder = (current.at(-1)?.sortOrder ?? -1) + 1;
  const fileName = safeFileName(input.originalName);
  const storageKey = `anniversary/${siteId}/${input.kind}/${Date.now()}-${nanoid(10)}-${fileName}`;
  const uploaded = await storagePut(storageKey, input.bytes, input.mimeType);
  await db.insert(mediaAssets).values({
    siteId,
    kind: input.kind,
    storageKey: uploaded.key,
    url: uploaded.url,
    originalName: input.originalName,
    mimeType: input.mimeType,
    sortOrder: nextOrder,
  });
  const created = (await db.select().from(mediaAssets).where(and(eq(mediaAssets.siteId, siteId), eq(mediaAssets.storageKey, uploaded.key))).limit(1))[0];
  if (!created) throw new Error("ไม่สามารถบันทึกข้อมูลไฟล์ได้");
  return created;
}

export async function deleteMediaAsset(siteId: number, id: number) {
  const db = await requireDb();
  await db.delete(mediaAssets).where(and(eq(mediaAssets.siteId, siteId), eq(mediaAssets.id, id)));
  return { success: true };
}

export async function updateMediaOrder(siteId: number, id: number, sortOrder: number) {
  const db = await requireDb();
  await db.update(mediaAssets).set({ sortOrder }).where(and(eq(mediaAssets.siteId, siteId), eq(mediaAssets.id, id)));
  return { success: true };
}
