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
  uiLayout: "soft-story" | "polaroid-journal" | "midnight-glass";
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
  songLabel: "Our Song ❤️", puzzleImageId: 0, uiLayout: "soft-story", welcomeTitle: "", welcomeMessage: "", fontFamily: "gaegu", customFontUrl: "", customFontName: "", backgroundStyle: "soft", themeMode: "light", visualTheme: "soft-love", questionLetterEnabled: false, questionLetterTitle: "คำถามถึงเธอ", questionLetterPrompts: [], questionLetterRecipient: "",
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

type DailyAnalytics = { date: string; views: number; letterResponses: number };
type SiteActivityKind = "created" | "settings" | "media" | "security" | "availability" | "clone" | "restore";
type SiteActivity = { id: string; at: string; kind: SiteActivityKind; label: string };

type StoredSite = {
  id: number;
  ownerId: number;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  viewCount?: number;
  lastViewedAt?: string;
  letterResponseCount?: number;
  isPaused?: boolean;
  pausedMessage?: string;
  dailyAnalytics?: DailyAnalytics[];
  activityLog?: SiteActivity[];
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
    uiLayout: normalized.uiLayout === "polaroid-journal" || normalized.uiLayout === "midnight-glass" ? normalized.uiLayout : "soft-story",
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

function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getDailyAnalytics(site: StoredSite, date = utcDateKey()) {
  const entries = site.dailyAnalytics ?? (site.dailyAnalytics = []);
  let entry = entries.find((item) => item.date === date);
  if (!entry) {
    entry = { date, views: 0, letterResponses: 0 };
    entries.push(entry);
  }
  site.dailyAnalytics = entries.sort((left, right) => right.date.localeCompare(left.date)).slice(0, 120);
  return entry;
}

function appendSiteActivity(site: StoredSite, kind: SiteActivityKind, label: string, at = new Date().toISOString()) {
  const activity: SiteActivity = { id: nanoid(12), at, kind, label };
  site.activityLog = [activity, ...(site.activityLog ?? [])].slice(0, 80);
  return activity;
}

function analyticsWindow(site: StoredSite, days = 7) {
  const byDate = new Map((site.dailyAnalytics ?? []).map((item) => [item.date, item]));
  return Array.from({ length: days }, (_, index) => {
    const date = utcDateKey(new Date(Date.now() - (days - 1 - index) * 86_400_000));
    const item = byDate.get(date);
    return { date, views: item?.views ?? 0, letterResponses: item?.letterResponses ?? 0 };
  });
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

export async function getDashboardOverviewForOwner(ownerId: number) {
  const { data } = await readRepository();
  const sites = data.sites.filter((site) => site.ownerId === ownerId);
  const dates = Array.from({ length: 7 }, (_, index) => utcDateKey(new Date(Date.now() - (6 - index) * 86_400_000)));
  const totalsByDate = new Map(dates.map((date) => [date, { date, views: 0, letterResponses: 0 }]));
  const activities: Array<SiteActivity & { siteSlug: string; siteTitle: string }> = [];
  let totalViews = 0;
  let totalLetters = 0;
  let storageBytes = 0;

  for (const site of sites) {
    totalViews += site.viewCount ?? 0;
    totalLetters += site.letterResponseCount ?? 0;
    storageBytes += site.assets.reduce((sum, asset) => sum + (asset.byteLength ?? 0), 0);
    for (const item of site.dailyAnalytics ?? []) {
      const aggregate = totalsByDate.get(item.date);
      if (aggregate) {
        aggregate.views += item.views;
        aggregate.letterResponses += item.letterResponses;
      }
    }
    activities.push(...(site.activityLog ?? []).map((item) => ({ ...item, siteSlug: site.slug, siteTitle: site.title })));
  }

  return {
    totals: { sites: sites.length, views: totalViews, letterResponses: totalLetters, storageBytes, pausedSites: sites.filter((site) => site.isPaused).length },
    trend: dates.map((date) => totalsByDate.get(date)!),
    recentActivity: activities.sort((left, right) => right.at.localeCompare(left.at)).slice(0, 12),
    sites: sites.map((site) => ({ ...toClientSite(site), viewCount: site.viewCount ?? 0, letterResponseCount: site.letterResponseCount ?? 0, storageBytes: site.assets.reduce((sum, asset) => sum + (asset.byteLength ?? 0), 0), isPaused: Boolean(site.isPaused), lastViewedAt: site.lastViewedAt ?? "" })),
  };
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
      letterResponseCount: 0,
      isPaused: false,
      pausedMessage: "เว็บไซต์นี้พักการแสดงผลชั่วคราว",
      dailyAnalytics: [],
      activityLog: [],
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
    appendSiteActivity(site, "created", "สร้างเว็บไซต์ใหม่", now);
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

export async function cloneSiteForOwner(ownerId: number, input: { sourceSlug: string; title: string; slug: string }) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: clone ${input.sourceSlug} to ${input.slug}`, (repository) => {
    const source = repository.sites.find((site) => site.ownerId === ownerId && site.slug === input.sourceSlug);
    if (!source) throw new Error("ไม่พบเว็บไซต์ต้นฉบับ หรือคุณไม่มีสิทธิ์โคลน");
    if (repository.sites.some((site) => site.slug === input.slug)) throw new Error("duplicate site slug");
    const now = new Date().toISOString();
    const siteId = repository.nextSiteId++;
    const settings: StoredSettings = {
      ...structuredClone(source.settings),
      id: repository.nextSettingsId++,
      siteId,
      pinHash: hashPin(DEFAULT_PIN),
      revisionLog: [{ at: now, label: `สร้างจากสำเนา ${source.title}` }],
      createdAt: now,
      updatedAt: now,
    };
    const assets = source.assets.map((asset) => ({ ...structuredClone(asset), id: repository.nextAssetId++, siteId, createdAt: now }));
    const cloned: StoredSite = {
      id: siteId,
      ownerId,
      slug: input.slug,
      title: input.title,
      createdAt: now,
      updatedAt: now,
      viewCount: 0,
      letterResponseCount: 0,
      isPaused: false,
      pausedMessage: "เว็บไซต์นี้พักการแสดงผลชั่วคราว",
      dailyAnalytics: [],
      activityLog: [],
      settings,
      assets,
    };
    appendSiteActivity(cloned, "clone", `สร้างสำเนาจาก ${source.title}`, now);
    appendSiteActivity(source, "clone", `สร้างสำเนาใหม่ชื่อ ${input.title}`, now);
    repository.sites.push(cloned);
    return { data: repository, result: toClientSite(cloned) };
  });
}

export async function setSiteAvailabilityForOwner(ownerId: number, slug: string, input: { isPaused: boolean; pausedMessage: string }) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: availability ${slug}`, (repository) => {
    const site = repository.sites.find((item) => item.ownerId === ownerId && item.slug === slug);
    if (!site) return { data: repository, result: { success: false, isPaused: false, pausedMessage: "" } };
    const now = new Date().toISOString();
    site.isPaused = input.isPaused;
    site.pausedMessage = input.pausedMessage.trim() || "เว็บไซต์นี้พักการแสดงผลชั่วคราว";
    site.updatedAt = now;
    appendSiteActivity(site, "availability", input.isPaused ? "พักการแสดงผลหน้าบ้าน" : "เปิดการแสดงผลหน้าบ้าน", now);
    return { data: repository, result: { success: true, isPaused: site.isPaused, pausedMessage: site.pausedMessage } };
  });
}

type SiteBackup = {
  version: 2;
  exportedAt: string;
  site: { title: string; slug: string };
  settings: Omit<StoredSettings, "id" | "siteId" | "pinHash" | "createdAt" | "updatedAt">;
  assets: Array<Omit<StoredAsset, "id" | "siteId" | "storageKey" | "createdAt">>;
};

export async function createSiteBackupForOwner(ownerId: number, slug: string): Promise<SiteBackup | undefined> {
  const site = await getOwnedSiteBySlug(ownerId, slug);
  if (!site) return undefined;
  const { id: _settingsId, siteId: _settingsSiteId, pinHash: _pinHash, createdAt: _settingsCreatedAt, updatedAt: _settingsUpdatedAt, ...settings } = structuredClone(site.settings);
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    site: { title: site.title, slug: site.slug },
    settings,
    assets: sortAssets(site.assets).map(({ id: _id, siteId: _siteId, storageKey: _storageKey, createdAt: _createdAt, ...asset }) => asset),
  };
}

export async function restoreSiteBackupForOwner(ownerId: number, slug: string, backup: SiteBackup) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: restore ${slug}`, (repository) => {
    const site = repository.sites.find((item) => item.ownerId === ownerId && item.slug === slug);
    if (!site) return { data: repository, result: { success: false, restoredAssets: 0 } };
    const now = new Date().toISOString();
    const originalPinHash = site.settings.pinHash;
    site.settings = {
      ...site.settings,
      ...structuredClone(backup.settings),
      id: site.settings.id,
      siteId: site.id,
      pinHash: originalPinHash,
      revisionLog: [{ at: now, label: "กู้คืนข้อมูลจากไฟล์สำรอง" }, ...(site.settings.revisionLog ?? [])].slice(0, 20),
      createdAt: site.settings.createdAt,
      updatedAt: now,
    };
    const previousStorageByUrl = new Map(site.assets.map((asset) => [asset.url, asset.storageKey]));
    site.assets = backup.assets.map((asset) => ({
      ...structuredClone(asset),
      id: repository.nextAssetId++,
      siteId: site.id,
      storageKey: previousStorageByUrl.get(asset.url) ?? "",
      createdAt: now,
    }));
    site.updatedAt = now;
    appendSiteActivity(site, "restore", "กู้คืนข้อมูลจากไฟล์สำรอง", now);
    return { data: repository, result: { success: true, restoredAssets: site.assets.length } };
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

export async function getPublicSiteStatus(slug: string) {
  const { data } = await readRepository();
  const site = data.sites.find((item) => item.slug === slug);
  if (!site) return undefined;
  return {
    siteId: site.id,
    isPaused: Boolean(site.isPaused),
    pausedMessage: site.pausedMessage?.trim() || "เว็บไซต์นี้พักการแสดงผลชั่วคราว",
  };
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
    letterResponseCount: site.letterResponseCount ?? 0,
    isPaused: Boolean(site.isPaused),
    pausedMessage: site.pausedMessage ?? "เว็บไซต์นี้พักการแสดงผลชั่วคราว",
    analytics: analyticsWindow(site, 30),
    activityLog: (site.activityLog ?? []).slice(0, 30),
  };
}

export async function recordSiteView(siteId: number) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: record view ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) return { data: repository, result: { success: false, views: 0 } };
    site.viewCount = (site.viewCount ?? 0) + 1;
    site.lastViewedAt = new Date().toISOString();
    getDailyAnalytics(site).views += 1;
    return { data: repository, result: { success: true, views: site.viewCount } };
  });
}

export async function recordSiteLetterResponse(siteId: number) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: record letter ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) return { data: repository, result: { success: false } };
    site.letterResponseCount = (site.letterResponseCount ?? 0) + 1;
    getDailyAnalytics(site).letterResponses += 1;
    appendSiteActivity(site, "security", "ได้รับคำตอบจดหมายจากผู้เยี่ยมชม");
    return { data: repository, result: { success: true } };
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
    appendSiteActivity(site, "settings", input.pin ? "บันทึกการตั้งค่าและเปลี่ยน PIN เว็บไซต์" : "บันทึกการตั้งค่าเว็บไซต์", now);
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
    appendSiteActivity(site, "media", "อัปโหลดฟอนต์ส่วนตัว", now);
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
    appendSiteActivity(site, "media", "อัปเดตเพลงพื้นหลัง", now);
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
    appendSiteActivity(site, "media", `อัปโหลด${input.kind === "image" ? "รูปภาพ" : input.kind === "video" ? "วิดีโอ" : "เพลง"}`);
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
    appendSiteActivity(site, "media", "ลบไฟล์สื่อ");
    return { data: repository, result: { success: true } };
  });
}

export async function deleteMediaAssets(siteId: number, ids: number[]) {
  const uniqueIds = Array.from(new Set(ids));
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: bulk remove media ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) return { data: repository, result: { success: false, removed: 0 } };
    const selected = site.assets.filter((asset) => uniqueIds.includes(asset.id));
    if (!selected.length) return { data: repository, result: { success: true, removed: 0 } };
    const removedUrls = new Set(selected.map((asset) => asset.url));
    site.assets = site.assets.filter((asset) => !uniqueIds.includes(asset.id));
    if (removedUrls.has(site.settings.musicUrl)) {
      site.settings.musicUrl = "";
      site.settings.updatedAt = new Date().toISOString();
    }
    site.updatedAt = new Date().toISOString();
    appendSiteActivity(site, "media", `ลบไฟล์สื่อ ${selected.length} รายการ`);
    return { data: repository, result: { success: true, removed: selected.length } };
  });
}

export async function updateMediaOrder(siteId: number, id: number, sortOrder: number) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: reorder media ${id}`, (repository) => {
    const site = getSite(repository, siteId);
    const asset = site?.assets.find((item) => item.id === id);
    if (!site || !asset) return { data: repository, result: { success: false } };
    asset.sortOrder = sortOrder;
    site.updatedAt = new Date().toISOString();
    appendSiteActivity(site, "media", "จัดเรียงสื่อใหม่");
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
    appendSiteActivity(site, "settings", "บันทึกข้อความกำกับรูปภาพ");
    return { data: repository, result: { success: true, caption: asset.caption } };
  });
}
