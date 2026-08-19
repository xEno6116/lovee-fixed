import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import { type InsertUser, type User, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { updateJson, readJson } from "./githubStorage";
import { DEFAULT_PIN, hashPin, safeFileName } from "./siteUtils";
import { storagePut } from "./storage";

type MediaKind = "image" | "video" | "audio";

type StoredSettings = {
  id: number;
  siteId: number;
  pinHash: string;
  startDate: string;
  memoryMessage: string;
  musicUrl: string;
  createdAt: string;
  updatedAt: string;
};

type StoredAsset = {
  id: number;
  siteId: number;
  kind: MediaKind;
  storageKey: string;
  url: string;
  originalName: string;
  mimeType: string;
  sortOrder: number;
  createdAt: string;
};

type StoredSite = {
  id: number;
  ownerId: number;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  settings: StoredSettings;
  assets: StoredAsset[];
};

type SiteRepository = {
  version: 1;
  nextSiteId: number;
  nextSettingsId: number;
  nextAssetId: number;
  sites: StoredSite[];
};

const SITE_DATA_PATH = "data/sites.json";

type ClientSite = Omit<StoredSite, "settings" | "assets">;
type ClientSettings = Omit<StoredSettings, "pinHash">;
type ClientAsset = Omit<StoredAsset, "storageKey">;

function emptyRepository(): SiteRepository {
  return { version: 1, nextSiteId: 1, nextSettingsId: 1, nextAssetId: 1, sites: [] };
}

async function readRepository() {
  return readJson(SITE_DATA_PATH, emptyRepository);
}

function getSite(repository: SiteRepository, siteId: number) {
  return repository.sites.find((site) => site.id === siteId);
}

function toClientSite({ settings: _settings, assets: _assets, ...site }: StoredSite): ClientSite {
  return site;
}

function toClientSettings({ pinHash: _pinHash, ...settings }: StoredSettings): ClientSettings {
  return settings;
}

function toClientAsset({ storageKey: _storageKey, ...asset }: StoredAsset): ClientAsset {
  return asset;
}

function sortAssets(assets: StoredAsset[]) {
  return [...assets].sort((left, right) =>
    left.kind.localeCompare(right.kind) || left.sortOrder - right.sortOrder || left.id - right.id,
  );
}

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) _db = drizzle(process.env.DATABASE_URL);
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลผู้ใช้ได้");
  return db;
}

/** User records remain compatible with the existing Manus OAuth session contract. */
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

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await requireDb();
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export async function listSitesForOwner(ownerId: number) {
  const { data } = await readRepository();
  return data.sites
    .filter((site) => site.ownerId === ownerId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id - left.id)
    .map(toClientSite);
}

export async function getOwnedSiteBySlug(ownerId: number, slug: string) {
  const { data } = await readRepository();
  return data.sites.find((site) => site.ownerId === ownerId && site.slug === slug);
}

export async function createSiteForOwner(ownerId: number, input: { title: string; slug: string }) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: create ${input.slug}`, (repository) => {
    if (repository.sites.some((site) => site.slug === input.slug)) {
      throw new Error("duplicate site slug");
    }
    const now = new Date().toISOString();
    const siteId = repository.nextSiteId++;
    const site: StoredSite = {
      id: siteId,
      ownerId,
      title: input.title,
      slug: input.slug,
      createdAt: now,
      updatedAt: now,
      settings: {
        id: repository.nextSettingsId++,
        siteId,
        pinHash: hashPin(DEFAULT_PIN),
        startDate: "2024-04-06",
        memoryMessage: "บันทึกความทรงจำของเรา",
        musicUrl: "",
        createdAt: now,
        updatedAt: now,
      },
      assets: [],
    };
    repository.sites.push(site);
    return { data: repository, result: toClientSite(site) };
  });
}

export async function deleteSiteForOwner(ownerId: number, slug: string) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: delete ${slug}`, (repository) => {
    const index = repository.sites.findIndex((site) => site.ownerId === ownerId && site.slug === slug);
    if (index === -1) return { data: repository, result: { success: false } };
    repository.sites.splice(index, 1);
    return { data: repository, result: { success: true } };
  });
}

export async function getSiteSettings(siteId: number) {
  const { data } = await readRepository();
  return getSite(data, siteId)?.settings;
}

export async function listMediaAssets(siteId: number, kind?: MediaKind) {
  const { data } = await readRepository();
  const site = getSite(data, siteId);
  if (!site) return [];
  return sortAssets(kind ? site.assets.filter((asset) => asset.kind === kind) : site.assets);
}

export async function getPrivateSiteData(ownerId: number, slug: string) {
  const site = await getOwnedSiteBySlug(ownerId, slug);
  if (!site) return undefined;
  const assets = sortAssets(site.assets);
  return {
    site: toClientSite(site),
    settings: {
      id: site.settings.id,
      startDate: site.settings.startDate,
      memoryMessage: site.settings.memoryMessage,
      musicUrl: site.settings.musicUrl,
    },
    images: assets.filter((asset) => asset.kind === "image").map(toClientAsset),
    videos: assets.filter((asset) => asset.kind === "video").map(toClientAsset),
  };
}

export async function getAdminSiteData(ownerId: number, slug: string) {
  const site = await getOwnedSiteBySlug(ownerId, slug);
  if (!site) return undefined;
  return {
    site: toClientSite(site),
    settings: toClientSettings(site.settings),
    assets: sortAssets(site.assets).map(toClientAsset),
  };
}

export async function verifySitePin(siteId: number, pin: string) {
  const settings = await getSiteSettings(siteId);
  return Boolean(settings && settings.pinHash === hashPin(pin));
}

export async function updateSiteSettings(siteId: number, input: { memoryMessage: string; startDate: string; pin?: string; musicUrl: string }) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: update settings ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) throw new Error("ไม่พบเว็บไซต์สำหรับบันทึกการตั้งค่า");
    const now = new Date().toISOString();
    site.settings = {
      ...site.settings,
      memoryMessage: input.memoryMessage,
      startDate: input.startDate,
      musicUrl: input.musicUrl,
      ...(input.pin ? { pinHash: hashPin(input.pin) } : {}),
      updatedAt: now,
    };
    site.updatedAt = now;
    return { data: repository, result: toClientSettings(site.settings) };
  });
}

export async function setMusicUrl(siteId: number, musicUrl: string) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: update music ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) throw new Error("ไม่พบเว็บไซต์สำหรับบันทึกเพลง");
    const now = new Date().toISOString();
    site.settings.musicUrl = musicUrl;
    site.settings.updatedAt = now;
    site.updatedAt = now;
    return { data: repository, result: undefined };
  });
}

export async function createMediaAsset(siteId: number, input: { kind: MediaKind; originalName: string; mimeType: string; bytes: Buffer }) {
  const fileName = safeFileName(input.originalName);
  const storageKey = `anniversary/${siteId}/${input.kind}/${Date.now()}-${nanoid(10)}-${fileName}`;
  const uploaded = await storagePut(storageKey, input.bytes, input.mimeType);

  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: add ${input.kind} ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) throw new Error("ไม่พบเว็บไซต์สำหรับบันทึกสื่อ");
    const nextOrder = (site.assets.filter((asset) => asset.kind === input.kind).at(-1)?.sortOrder ?? -1) + 1;
    const created: StoredAsset = {
      id: repository.nextAssetId++,
      siteId,
      kind: input.kind,
      storageKey: uploaded.key,
      url: uploaded.url,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sortOrder: nextOrder,
      createdAt: new Date().toISOString(),
    };
    site.assets.push(created);
    site.updatedAt = new Date().toISOString();
    return { data: repository, result: toClientAsset(created) };
  });
}

export async function deleteMediaAsset(siteId: number, id: number) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: remove media ${id}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) return { data: repository, result: { success: false } };
    const assetIndex = site.assets.findIndex((asset) => asset.id === id);
    if (assetIndex === -1) return { data: repository, result: { success: false } };
    site.assets.splice(assetIndex, 1);
    site.updatedAt = new Date().toISOString();
    return { data: repository, result: { success: true } };
  });
}

export async function updateMediaOrder(siteId: number, id: number, sortOrder: number) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: reorder media ${id}`, (repository) => {
    const site = getSite(repository, siteId);
    const asset = site?.assets.find((item) => item.id === id);
    if (!site || !asset) return { data: repository, result: { success: false } };
    asset.sortOrder = sortOrder;
    site.updatedAt = new Date().toISOString();
    return { data: repository, result: { success: true } };
  });
}
