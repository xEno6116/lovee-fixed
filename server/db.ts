import { nanoid } from "nanoid";
import type { InsertUser, User } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { updateJson, readJson } from "./githubStorage";
import { DEFAULT_PIN, hashPin, safeFileName } from "./siteUtils";
import { storagePut } from "./storage";

type MediaKind = "image" | "video" | "audio";

type TimelineEntry = { id: string; title: string; date: string; description: string };
type PlaceEntry = { id: string; name: string; mapUrl: string };
type StoryNote = { id: string; title: string; body: string; publishAt: string };
export type QuestionEntry = { id: string; prompt: string };
export type FeatureSettings = {
  songLabel: string;
  puzzleImageId: number;
  welcomeTitle: string;
  welcomeMessage: string;
  fontFamily: "gaegu" | "serif" | "sans";
  customFontUrl: string;
  customFontName: string;
  backgroundStyle: "soft" | "sunset" | "night" | "paper";
  themeMode: "light" | "night" | "auto";
  visualTheme: "soft-love" | "minimal-white" | "midnight-date" | "film-diary" | "lavender-dream" | "sunset-memory";
  questionLetterEnabled: boolean;
  questionLetterTitle: string;
  /** Kept only while existing GitHub JSON is migrated into questionLetterPrompts. */
  questionLetterPrompt?: string;
  questionLetterPrompts: QuestionEntry[];
  questionLetterRecipient: string;
  hideVideos: boolean;
  hideGallery: boolean;
  hideMessage: boolean;
  surpriseTitle: string;
  surpriseMessage: string;
  surpriseAt: string;
  timeline: TimelineEntry[];
  places: PlaceEntry[];
  notes: StoryNote[];
  ownerNote: string;
};

const defaultFeatureSettings = (): FeatureSettings => ({
  songLabel: "Our Song ❤️", puzzleImageId: 0, welcomeTitle: "", welcomeMessage: "", fontFamily: "gaegu", customFontUrl: "", customFontName: "", backgroundStyle: "soft", themeMode: "light", visualTheme: "soft-love", questionLetterEnabled: false, questionLetterTitle: "คำถามถึงเธอ", questionLetterPrompts: [], questionLetterRecipient: "",
  hideVideos: false, hideGallery: false, hideMessage: false, surpriseTitle: "", surpriseMessage: "", surpriseAt: "", timeline: [], places: [], notes: [], ownerNote: "",
});

type StoredSettings = {
  id: number;
  siteId: number;
  pinHash: string;
  startDate: string;
  memoryMessage: string;
  musicUrl: string;
  facebookUrl?: string;
  instagramUrl?: string;
  themeColor?: string;
  features?: FeatureSettings;
  revisionLog?: { at: string; label: string }[];
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
  caption?: string;
  byteLength?: number;
  createdAt: string;
};

type StoredSite = {
  id: number;
  ownerId: number;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  viewCount?: number;
  lastViewedAt?: string;
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

function normalizeFeatureSettings(features?: Partial<FeatureSettings>): FeatureSettings {
  const normalized = { ...defaultFeatureSettings(), ...(features ?? {}) };
  const prompts = Array.isArray(normalized.questionLetterPrompts)
    ? normalized.questionLetterPrompts
      .filter((item): item is QuestionEntry => Boolean(item && typeof item.id === "string" && typeof item.prompt === "string"))
      .map((item) => ({ id: item.id.trim(), prompt: item.prompt.trim() }))
      .filter((item) => item.id && item.prompt)
      .slice(0, 10)
    : [];
  const legacyPrompt = normalized.questionLetterPrompt?.trim();
  return {
    ...normalized,
    questionLetterPrompts: prompts.length ? prompts : legacyPrompt ? [{ id: "legacy-question", prompt: legacyPrompt }] : [],
  };
}

function normalizeFeatures(settings: StoredSettings): FeatureSettings {
  return normalizeFeatureSettings(settings.features);
}

function toPublicFeatures(settings: StoredSettings) {
  const { ownerNote: _ownerNote, questionLetterRecipient: _questionLetterRecipient, questionLetterPrompt: _legacyQuestionLetterPrompt, ...features } = normalizeFeatures(settings);
  return features;
}

function toVisitorSite(site: StoredSite) {
  return { id: site.id, title: site.title, slug: site.slug };
}

export async function getQuestionLetterBySlug(slug: string) {
  const { data } = await readRepository();
  const site = data.sites.find((item) => item.slug === slug);
  if (!site) return undefined;
  const features = normalizeFeatures(site.settings);
  return { siteTitle: site.title, enabled: features.questionLetterEnabled, title: features.questionLetterTitle, prompts: features.questionLetterPrompts, recipient: features.questionLetterRecipient };
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
  return {
    ...user,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
    lastSignedIn: new Date(user.lastSignedIn),
  };
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
      viewCount: 0,
      settings: {
        id: repository.nextSettingsId++,
        siteId,
        pinHash: hashPin(DEFAULT_PIN),
        startDate: "2024-04-06",
        memoryMessage: "บันทึกความทรงจำของเรา",
        musicUrl: "",
        facebookUrl: "",
        instagramUrl: "",
        themeColor: "#ec4899",
        features: defaultFeatureSettings(),
        revisionLog: [],
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
      facebookUrl: site.settings.facebookUrl ?? "",
      instagramUrl: site.settings.instagramUrl ?? "",
      themeColor: site.settings.themeColor ?? "#ec4899",
      features: toPublicFeatures(site.settings),
    },
    images: assets.filter((asset) => asset.kind === "image").map(toClientAsset),
    videos: assets.filter((asset) => asset.kind === "video").map(toClientAsset),
  };
}

export async function getVisitorSiteIdBySlug(slug: string) {
  const { data } = await readRepository();
  return data.sites.find((site) => site.slug === slug)?.id;
}

export async function getVisitorSiteData(siteId: number, slug: string) {
  const { data } = await readRepository();
  const site = data.sites.find((item) => item.id === siteId && item.slug === slug);
  if (!site) return undefined;
  const assets = sortAssets(site.assets);
  return {
    site: toVisitorSite(site),
    settings: {
      id: site.settings.id,
      startDate: site.settings.startDate,
      memoryMessage: site.settings.memoryMessage,
      musicUrl: site.settings.musicUrl,
      facebookUrl: site.settings.facebookUrl ?? "",
      instagramUrl: site.settings.instagramUrl ?? "",
      themeColor: site.settings.themeColor ?? "#ec4899",
      features: toPublicFeatures(site.settings),
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
    settings: { ...toClientSettings(site.settings), features: normalizeFeatures(site.settings) },
    assets: sortAssets(site.assets).map(toClientAsset),
    storageBytes: site.assets.reduce((sum, asset) => sum + (asset.byteLength ?? 0), 0),
    viewCount: site.viewCount ?? 0,
    lastViewedAt: site.lastViewedAt ?? "",
  };
}

export async function recordSiteView(siteId: number) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: record view ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) return { data: repository, result: { success: false, views: 0 } };
    site.viewCount = (site.viewCount ?? 0) + 1;
    site.lastViewedAt = new Date().toISOString();
    return { data: repository, result: { success: true, views: site.viewCount } };
  });
}

export async function verifySitePin(siteId: number, pin: string) {
  const settings = await getSiteSettings(siteId);
  return Boolean(settings && settings.pinHash === hashPin(pin));
}

export async function updateSiteSettings(siteId: number, input: { facebookUrl: string; instagramUrl: string; themeColor: string; musicUrl: string; pin?: string; features?: FeatureSettings }) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: update settings ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) throw new Error("ไม่พบเว็บไซต์สำหรับบันทึกการตั้งค่า");
    const now = new Date().toISOString();
    site.settings = {
      ...site.settings,
      facebookUrl: input.facebookUrl,
      instagramUrl: input.instagramUrl,
      themeColor: input.themeColor,
      musicUrl: input.musicUrl,
      ...(input.features ? { features: normalizeFeatureSettings(input.features) } : {}),
      ...(input.pin ? { pinHash: hashPin(input.pin) } : {}),
      revisionLog: [{ at: now, label: "อัปเดตการตั้งค่าเว็บไซต์" }, ...(site.settings.revisionLog ?? [])].slice(0, 20),
      updatedAt: now,
    };
    site.updatedAt = now;
    return { data: repository, result: toClientSettings(site.settings) };
  });
}

export async function uploadCustomFont(siteId: number, input: { originalName: string; mimeType: string; bytes: Buffer }) {
  const storageKey = `anniversary/${siteId}/fonts/${Date.now()}-${safeFileName(input.originalName)}`;
  const uploaded = await storagePut(storageKey, input.bytes, input.mimeType);
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: update font ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) throw new Error("ไม่พบเว็บไซต์สำหรับบันทึกฟอนต์");
    const now = new Date().toISOString();
    site.settings.features = { ...normalizeFeatures(site.settings), customFontUrl: uploaded.url, customFontName: input.originalName };
    site.settings.revisionLog = [{ at: now, label: "อัปโหลดฟอนต์ส่วนตัว" }, ...(site.settings.revisionLog ?? [])].slice(0, 20);
    site.settings.updatedAt = now;
    site.updatedAt = now;
    return { data: repository, result: { url: uploaded.url, name: input.originalName } };
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
      byteLength: input.bytes.byteLength,
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
    if (site.assets[assetIndex].kind === "audio" && site.settings.musicUrl === site.assets[assetIndex].url) {
      site.settings.musicUrl = "";
      site.settings.updatedAt = new Date().toISOString();
    }
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

export async function updateImageCaption(siteId: number, id: number, caption: string) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: update image caption ${id}`, (repository) => {
    const site = getSite(repository, siteId);
    const asset = site?.assets.find((item) => item.id === id && item.kind === "image");
    if (!site || !asset) return { data: repository, result: { success: false, caption: "" } };
    asset.caption = caption.trim();
    site.updatedAt = new Date().toISOString();
    return { data: repository, result: { success: true, caption: asset.caption } };
  });
}
