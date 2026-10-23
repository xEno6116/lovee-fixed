import { nanoid } from "nanoid";
import type { InsertUser, User } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { updateJson, readJson } from "./githubStorage";
import { DEFAULT_PIN, hashPin, safeFileName } from "./siteUtils";
import { storagePrepareUpload, storagePut } from "./storage";

type MediaKind = "image" | "video" | "audio";

type StoredSettings = {
  id: number;
  siteId: number;
  pinHash: string;
  startDate: string;
  memoryMessage: string;
  secretMessage?: string;
  musicUrl: string;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  themeColor?: string;
  backgroundStyle?: "soft" | "sunset" | "night" | "paper";
  themeMode?: "light" | "night";
  fontFamily?: "gaegu" | "serif" | "sans";
  letterRecipientEmail?: string;
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
const USER_DATA_PATH = "data/users.json";
export const FREE_SITE_LIMIT = 1;

type StoredUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "admin" | "user";
  createdAt: string;
  updatedAt: string;
  lastSignedIn: string;
  passwordHash?: string;
};

type UserRepository = {
  version: 1;
  nextUserId: number;
  users: StoredUser[];
};

type ClientSite = Omit<StoredSite, "settings" | "assets">;
type ClientSettings = Omit<StoredSettings, "pinHash">;
type ClientAsset = Omit<StoredAsset, "storageKey">;

function emptyRepository(): SiteRepository {
  return { version: 1, nextSiteId: 1, nextSettingsId: 1, nextAssetId: 1, sites: [] };
}

function emptyUserRepository(): UserRepository {
  return { version: 1, nextUserId: 1, users: [] };
}

async function readRepository() {
  return readJson(SITE_DATA_PATH, emptyRepository);
}

async function readUserRepository() {
  return readJson(USER_DATA_PATH, emptyUserRepository);
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

function toApplicationUser(user: StoredUser): User {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return {
    ...safeUser,
    createdAt: new Date(safeUser.createdAt),
    updatedAt: new Date(safeUser.updatedAt),
    lastSignedIn: new Date(safeUser.lastSignedIn),
  };
}

export async function getLocalUserByEmail(email: string): Promise<StoredUser | undefined> {
  const { data } = await readUserRepository();
  const normalized = email.trim().toLowerCase();
  return data.users.find((item) => item.email?.toLowerCase() === normalized && item.loginMethod === "local-password");
}

export async function createLocalUser(input: { email: string; name: string; passwordHash: string }): Promise<StoredUser> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const openId = `local_${nanoid(24)}`;
  return updateJson(USER_DATA_PATH, emptyUserRepository, `anniversary: register local user ${normalizedEmail}`, (repository) => {
    if (repository.users.some((item) => item.email?.toLowerCase() === normalizedEmail)) {
      throw new Error("อีเมลนี้มีบัญชีอยู่แล้ว");
    }
    const now = new Date().toISOString();
    const user: StoredUser = {
      id: repository.nextUserId++,
      openId,
      name: input.name.trim(),
      email: normalizedEmail,
      loginMethod: "local-password",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
      passwordHash: input.passwordHash,
    };
    repository.users.push(user);
    return { data: repository, result: user };
  });
}

/** User records are kept in GitHub JSON while retaining the OAuth session contract. */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  await updateJson(USER_DATA_PATH, emptyUserRepository, `anniversary: sync user ${user.openId}`, (repository) => {
    const now = new Date();
    const existing = repository.users.find((item) => item.openId === user.openId);
    const role = user.role ?? existing?.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
    const lastSignedIn = user.lastSignedIn ?? now;

    if (existing) {
      existing.name = user.name !== undefined ? user.name ?? null : existing.name;
      existing.email = user.email !== undefined ? user.email ?? null : existing.email;
      existing.loginMethod = user.loginMethod !== undefined ? user.loginMethod ?? null : existing.loginMethod;
      existing.role = role;
      existing.lastSignedIn = lastSignedIn.toISOString();
      existing.updatedAt = now.toISOString();
      return { data: repository, result: undefined };
    }

    repository.users.push({
      id: repository.nextUserId++,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastSignedIn: lastSignedIn.toISOString(),
    });
    return { data: repository, result: undefined };
  });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const { data } = await readUserRepository();
  const user = data.users.find((item) => item.openId === openId);
  return user ? toApplicationUser(user) : undefined;
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
    if (repository.sites.filter((site) => site.ownerId === ownerId).length >= FREE_SITE_LIMIT) {
      throw new Error("owner site limit reached");
    }
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
        startDate: "",
        memoryMessage: "บันทึกความทรงจำของเรา",
        musicUrl: "",
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
        themeColor: "#ec4899",
        backgroundStyle: "soft",
        themeMode: "light",
        fontFamily: "gaegu",
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
  return toPublicSiteData(site, true);
}

function toPublicSiteData(site: StoredSite, unlocked: boolean) {
  const assets = sortAssets(site.assets);
  const expiresAt = site.settings.expiresAt ?? null;
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
  const locked = Number.isFinite(expiresAtMs) && Date.now() >= expiresAtMs;
  return {
    site: toClientSite(site),
    settings: {
      id: site.settings.id,
      startDate: site.settings.startDate,
      memoryMessage: unlocked ? site.settings.memoryMessage : "",
      secretMessage: unlocked ? site.settings.secretMessage ?? "" : undefined,
      musicUrl: unlocked ? site.settings.musicUrl : "",
      expiresAt,
      themeColor: site.settings.themeColor ?? "#ec4899",
      backgroundStyle: site.settings.backgroundStyle ?? "soft",
      themeMode: site.settings.themeMode ?? "light",
      fontFamily: site.settings.fontFamily ?? "gaegu",
    },
    locked,
    deletionAt: Number.isFinite(expiresAtMs) ? new Date(expiresAtMs + 3 * 86_400_000).toISOString() : null,
    images: unlocked ? assets.filter((asset) => asset.kind === "image").map(toClientAsset) : [],
    videos: unlocked ? assets.filter((asset) => asset.kind === "video").map(toClientAsset) : [],
  };
}

export async function getPublicSitePreview(slug: string) {
  const { data } = await readRepository();
  const site = data.sites.find((item) => item.slug === slug);
  return site ? toPublicSiteData(site, false) : undefined;
}

export async function unlockPublicSite(slug: string, pin: string) {
  const { data } = await readRepository();
  const site = data.sites.find((item) => item.slug === slug);
  if (!site || site.settings.pinHash !== hashPin(pin)) return undefined;
  return toPublicSiteData(site, true);
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

export async function getSiteForLetter(slug: string) {
  const { data } = await readRepository();
  const site = data.sites.find((item) => item.slug === slug);
  if (!site || !site.settings.letterRecipientEmail) return undefined;
  return { title: site.title, recipientEmail: site.settings.letterRecipientEmail };
}

export async function verifySitePin(siteId: number, pin: string) {
  const settings = await getSiteSettings(siteId);
  return Boolean(settings && settings.pinHash === hashPin(pin));
}

export async function updateSiteSettings(siteId: number, input: { memoryMessage: string; secretMessage?: string; startDate: string; pin?: string; musicUrl: string; expiresAt?: string | null; themeColor?: string; backgroundStyle?: StoredSettings["backgroundStyle"]; themeMode?: StoredSettings["themeMode"]; fontFamily?: StoredSettings["fontFamily"]; letterRecipientEmail?: string }) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: update settings ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) throw new Error("ไม่พบเว็บไซต์สำหรับบันทึกการตั้งค่า");
    const now = new Date().toISOString();
    site.settings = {
      ...site.settings,
      memoryMessage: input.memoryMessage,
      secretMessage: input.secretMessage ?? site.settings.secretMessage ?? "",
      startDate: input.startDate,
      musicUrl: input.musicUrl,
      ...(input.themeColor ? { themeColor: input.themeColor } : {}),
      ...(input.backgroundStyle ? { backgroundStyle: input.backgroundStyle } : {}),
      ...(input.themeMode ? { themeMode: input.themeMode } : {}),
      ...(input.fontFamily ? { fontFamily: input.fontFamily } : {}),
      ...(input.letterRecipientEmail !== undefined ? { letterRecipientEmail: input.letterRecipientEmail.trim() } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      ...(input.pin ? { pinHash: hashPin(input.pin) } : {}),
      updatedAt: now,
    };
    site.updatedAt = now;
    return { data: repository, result: toClientSettings(site.settings) };
  });
}

/** Removes expired sites after the three-day grace period. Removing media keys
 * from the repository makes the associated storage objects unreachable. */
export async function purgeExpiredSites(now = Date.now()) {
  return updateJson(SITE_DATA_PATH, emptyRepository, "anniversary: purge expired sites", (repository) => {
    const before = repository.sites.length;
    repository.sites = repository.sites.filter((site) => {
      const expiresAtMs = site.settings.expiresAt ? new Date(site.settings.expiresAt).getTime() : NaN;
      return !Number.isFinite(expiresAtMs) || now < expiresAtMs + 3 * 86_400_000;
    });
    return { data: repository, result: { deleted: before - repository.sites.length } };
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

export async function prepareMediaUpload(siteId: number, input: { kind: MediaKind; originalName: string; mimeType: string }) {
  const fileName = safeFileName(input.originalName);
  const storageKey = `anniversary/${siteId}/${input.kind}/${Date.now()}-${nanoid(10)}-${fileName}`;
  return storagePrepareUpload(storageKey, input.mimeType);
}

export async function finalizeMediaAsset(
  siteId: number,
  input: { kind: MediaKind; originalName: string; mimeType: string; key: string; url: string },
) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: add ${input.kind} ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) throw new Error("ไม่พบเว็บไซต์สำหรับบันทึกสื่อ");
    const nextOrder = (site.assets.filter((asset) => asset.kind === input.kind).at(-1)?.sortOrder ?? -1) + 1;
    const created: StoredAsset = {
      id: repository.nextAssetId++,
      siteId,
      kind: input.kind,
      storageKey: input.key,
      url: input.url,
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
