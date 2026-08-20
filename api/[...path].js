// server/_core/app.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/routers.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
import { z as z3 } from "zod";

// server/_core/cookies.ts
var LOCAL_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1"]);
function isIpAddress(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}
function isSecureRequest(req) {
  const hostname = req.hostname?.split(":")[0]?.toLowerCase() ?? "";
  if (hostname && !LOCAL_HOSTS.has(hostname) && !isIpAddress(hostname)) return true;
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// server/_core/ownerAuth.ts
import { timingSafeEqual } from "node:crypto";

// server/db.ts
import { nanoid } from "nanoid";

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? ""
};

// server/githubStorage.ts
var GitHubStorageError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = "GitHubStorageError";
  }
};
var REPOSITORY_OWNER = "xEno6116";
var REPOSITORY_NAME = "lovee-data";
var API_ROOT = `https://api.github.com/repos/${REPOSITORY_OWNER}/${REPOSITORY_NAME}/contents`;
var latestCommitByPath = /* @__PURE__ */ new Map();
function requireToken() {
  const token = process.env.GITHUB_DATA_TOKEN;
  if (!token) {
    throw new Error("\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E01\u0E33\u0E2B\u0E19\u0E14 GITHUB_DATA_TOKEN \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E17\u0E35\u0E48\u0E40\u0E01\u0E47\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C");
  }
  return token;
}
function apiUrl(path, ref) {
  const url = new URL(`${API_ROOT}/${path.split("/").map(encodeURIComponent).join("/")}`);
  if (ref) url.searchParams.set("ref", ref);
  return url.toString();
}
async function request(path, init = {}, ref) {
  const response = await fetch(apiUrl(path, ref), {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${requireToken()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers ?? {}
    }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new GitHubStorageError(payload.message || "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D GitHub data repository \u0E44\u0E14\u0E49", response.status);
  }
  return await response.json();
}
async function readJson(path, makeDefault) {
  try {
    const file = await request(path, {}, latestCommitByPath.get(path));
    if (!file.content || file.encoding !== "base64" || !file.sha) {
      throw new Error(`\u0E44\u0E1F\u0E25\u0E4C\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 ${path} \u0E21\u0E35\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07`);
    }
    const decoded = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
    return { data: JSON.parse(decoded), sha: file.sha };
  } catch (error) {
    if (error instanceof GitHubStorageError && error.status === 404) {
      return { data: makeDefault() };
    }
    throw error;
  }
}
async function writeJson(path, data, message, sha) {
  const content = Buffer.from(`${JSON.stringify(data, null, 2)}
`, "utf8").toString("base64");
  const written = await request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content, ...sha ? { sha } : {} })
  });
  if (written.commit?.sha) latestCommitByPath.set(path, written.commit.sha);
  return written;
}
async function updateJson(path, makeDefault, message, mutate) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, sha } = await readJson(path, makeDefault);
    const updated = await mutate(data);
    try {
      await writeJson(path, updated.data, message, sha);
      return updated.result;
    } catch (error) {
      if (error instanceof GitHubStorageError && (error.status === 409 || error.status === 422) && attempt < 2) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2B\u0E25\u0E31\u0E07\u0E08\u0E32\u0E01\u0E25\u0E2D\u0E07\u0E0B\u0E49\u0E33\u0E41\u0E25\u0E49\u0E27");
}

// server/siteUtils.ts
import { Buffer as Buffer2 } from "node:buffer";
import { createHash } from "node:crypto";
var DEFAULT_PIN = "0000";
function hashPin(pin) {
  return createHash("sha256").update(pin).digest("hex");
}
function isValidPin(pin) {
  return /^\d{4}$/.test(pin);
}
function safeFileName(name) {
  const normalized = name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-");
  return normalized.replace(/-+/g, "-").replace(/^-|-$/g, "") || "upload";
}
function decodeDataUrl(dataUrl) {
  const matched = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!matched) throw new Error("\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E1F\u0E25\u0E4C\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07");
  const [, mimeType, encoded] = matched;
  const bytes = Buffer2.from(encoded, "base64");
  if (!bytes.length) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E1F\u0E25\u0E4C");
  return { mimeType, bytes };
}
function isAllowedMedia(kind, mimeType) {
  if (kind === "image") return mimeType.startsWith("image/");
  if (kind === "video") return mimeType.startsWith("video/");
  return mimeType.startsWith("audio/");
}
function isAllowedFont(fileName, mimeType) {
  const extension = fileName.toLowerCase().match(/\.(woff2?|ttf|otf)$/)?.[1];
  return Boolean(extension) && (mimeType.startsWith("font/") || mimeType === "application/font-sfnt" || mimeType === "application/vnd.ms-fontobject" || mimeType === "application/octet-stream");
}
function fontMimeTypeFromFileName(fileName, fallbackMimeType) {
  const extension = fileName.toLowerCase().match(/\.(woff2?|ttf|otf)$/)?.[1];
  if (extension === "woff2") return "font/woff2";
  if (extension === "woff") return "font/woff";
  if (extension === "ttf") return "font/ttf";
  if (extension === "otf") return "font/otf";
  return fallbackMimeType;
}

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}

// server/db.ts
var defaultFeatureSettings = () => ({
  songLabel: "Our Song \u2764\uFE0F",
  welcomeTitle: "",
  welcomeMessage: "",
  fontFamily: "gaegu",
  customFontUrl: "",
  customFontName: "",
  backgroundStyle: "soft",
  themeMode: "light",
  visualTheme: "soft-love",
  hideVideos: false,
  hideGallery: false,
  hideMessage: false,
  surpriseTitle: "",
  surpriseMessage: "",
  surpriseAt: "",
  timeline: [],
  places: [],
  notes: [],
  ownerNote: ""
});
var SITE_DATA_PATH = "data/sites.json";
var USER_DATA_PATH = "data/users.json";
function emptyRepository() {
  return { version: 1, nextSiteId: 1, nextSettingsId: 1, nextAssetId: 1, sites: [] };
}
function emptyUserRepository() {
  return { version: 1, nextUserId: 1, users: [] };
}
async function readRepository() {
  return readJson(SITE_DATA_PATH, emptyRepository);
}
async function readUserRepository() {
  return readJson(USER_DATA_PATH, emptyUserRepository);
}
function getSite(repository, siteId) {
  return repository.sites.find((site) => site.id === siteId);
}
function toClientSite({ settings: _settings, assets: _assets, ...site }) {
  return site;
}
function toClientSettings({ pinHash: _pinHash, ...settings }) {
  return settings;
}
function normalizeFeatures(settings) {
  return { ...defaultFeatureSettings(), ...settings.features ?? {} };
}
function toPublicFeatures(settings) {
  const { ownerNote: _ownerNote, ...features } = normalizeFeatures(settings);
  return features;
}
function toClientAsset({ storageKey: _storageKey, ...asset }) {
  return asset;
}
function sortAssets(assets) {
  return [...assets].sort(
    (left, right) => left.kind.localeCompare(right.kind) || left.sortOrder - right.sortOrder || left.id - right.id
  );
}
function toApplicationUser(user) {
  return {
    ...user,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
    lastSignedIn: new Date(user.lastSignedIn)
  };
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  await updateJson(USER_DATA_PATH, emptyUserRepository, `anniversary: sync user ${user.openId}`, (repository) => {
    const now = /* @__PURE__ */ new Date();
    const existing = repository.users.find((item) => item.openId === user.openId);
    const role = user.role ?? existing?.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
    const lastSignedIn = user.lastSignedIn ?? now;
    if (existing) {
      existing.name = user.name !== void 0 ? user.name ?? null : existing.name;
      existing.email = user.email !== void 0 ? user.email ?? null : existing.email;
      existing.loginMethod = user.loginMethod !== void 0 ? user.loginMethod ?? null : existing.loginMethod;
      existing.role = role;
      existing.lastSignedIn = lastSignedIn.toISOString();
      existing.updatedAt = now.toISOString();
      return { data: repository, result: void 0 };
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
      lastSignedIn: lastSignedIn.toISOString()
    });
    return { data: repository, result: void 0 };
  });
}
async function getUserByOpenId(openId) {
  const { data } = await readUserRepository();
  const user = data.users.find((item) => item.openId === openId);
  return user ? toApplicationUser(user) : void 0;
}
async function listSitesForOwner(ownerId) {
  const { data } = await readRepository();
  return data.sites.filter((site) => site.ownerId === ownerId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id - left.id).map(toClientSite);
}
async function getOwnedSiteBySlug(ownerId, slug) {
  const { data } = await readRepository();
  return data.sites.find((site) => site.ownerId === ownerId && site.slug === slug);
}
async function createSiteForOwner(ownerId, input) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: create ${input.slug}`, (repository) => {
    if (repository.sites.some((site2) => site2.slug === input.slug)) {
      throw new Error("duplicate site slug");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const siteId = repository.nextSiteId++;
    const site = {
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
        memoryMessage: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E04\u0E27\u0E32\u0E21\u0E17\u0E23\u0E07\u0E08\u0E33\u0E02\u0E2D\u0E07\u0E40\u0E23\u0E32",
        musicUrl: "",
        facebookUrl: "",
        instagramUrl: "",
        themeColor: "#ec4899",
        features: defaultFeatureSettings(),
        revisionLog: [],
        createdAt: now,
        updatedAt: now
      },
      assets: []
    };
    repository.sites.push(site);
    return { data: repository, result: toClientSite(site) };
  });
}
async function deleteSiteForOwner(ownerId, slug) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: delete ${slug}`, (repository) => {
    const index = repository.sites.findIndex((site) => site.ownerId === ownerId && site.slug === slug);
    if (index === -1) return { data: repository, result: { success: false } };
    repository.sites.splice(index, 1);
    return { data: repository, result: { success: true } };
  });
}
async function getSiteSettings(siteId) {
  const { data } = await readRepository();
  return getSite(data, siteId)?.settings;
}
async function listMediaAssets(siteId, kind) {
  const { data } = await readRepository();
  const site = getSite(data, siteId);
  if (!site) return [];
  return sortAssets(kind ? site.assets.filter((asset) => asset.kind === kind) : site.assets);
}
async function getPrivateSiteData(ownerId, slug) {
  const site = await getOwnedSiteBySlug(ownerId, slug);
  if (!site) return void 0;
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
      features: toPublicFeatures(site.settings)
    },
    images: assets.filter((asset) => asset.kind === "image").map(toClientAsset),
    videos: assets.filter((asset) => asset.kind === "video").map(toClientAsset)
  };
}
async function getAdminSiteData(ownerId, slug) {
  const site = await getOwnedSiteBySlug(ownerId, slug);
  if (!site) return void 0;
  return {
    site: toClientSite(site),
    settings: toClientSettings(site.settings),
    assets: sortAssets(site.assets).map(toClientAsset),
    storageBytes: site.assets.reduce((sum, asset) => sum + (asset.byteLength ?? 0), 0),
    viewCount: site.viewCount ?? 0,
    lastViewedAt: site.lastViewedAt ?? ""
  };
}
async function recordSiteView(siteId) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: record view ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) return { data: repository, result: { success: false, views: 0 } };
    site.viewCount = (site.viewCount ?? 0) + 1;
    site.lastViewedAt = (/* @__PURE__ */ new Date()).toISOString();
    return { data: repository, result: { success: true, views: site.viewCount } };
  });
}
async function verifySitePin(siteId, pin) {
  const settings = await getSiteSettings(siteId);
  return Boolean(settings && settings.pinHash === hashPin(pin));
}
async function updateSiteSettings(siteId, input) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: update settings ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    site.settings = {
      ...site.settings,
      facebookUrl: input.facebookUrl,
      instagramUrl: input.instagramUrl,
      themeColor: input.themeColor,
      musicUrl: input.musicUrl,
      ...input.features ? { features: input.features } : {},
      ...input.pin ? { pinHash: hashPin(input.pin) } : {},
      revisionLog: [{ at: now, label: "\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E01\u0E32\u0E23\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C" }, ...site.settings.revisionLog ?? []].slice(0, 20),
      updatedAt: now
    };
    site.updatedAt = now;
    return { data: repository, result: toClientSettings(site.settings) };
  });
}
async function uploadCustomFont(siteId, input) {
  const storageKey = `anniversary/${siteId}/fonts/${Date.now()}-${safeFileName(input.originalName)}`;
  const uploaded = await storagePut(storageKey, input.bytes, input.mimeType);
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: update font ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E1F\u0E2D\u0E19\u0E15\u0E4C");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    site.settings.features = { ...normalizeFeatures(site.settings), customFontUrl: uploaded.url, customFontName: input.originalName };
    site.settings.revisionLog = [{ at: now, label: "\u0E2D\u0E31\u0E1B\u0E42\u0E2B\u0E25\u0E14\u0E1F\u0E2D\u0E19\u0E15\u0E4C\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E31\u0E27" }, ...site.settings.revisionLog ?? []].slice(0, 20);
    site.settings.updatedAt = now;
    site.updatedAt = now;
    return { data: repository, result: { url: uploaded.url, name: input.originalName } };
  });
}
async function setMusicUrl(siteId, musicUrl) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: update music ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E40\u0E1E\u0E25\u0E07");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    site.settings.musicUrl = musicUrl;
    site.settings.updatedAt = now;
    site.updatedAt = now;
    return { data: repository, result: void 0 };
  });
}
async function createMediaAsset(siteId, input) {
  const fileName = safeFileName(input.originalName);
  const storageKey = `anniversary/${siteId}/${input.kind}/${Date.now()}-${nanoid(10)}-${fileName}`;
  const uploaded = await storagePut(storageKey, input.bytes, input.mimeType);
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: add ${input.kind} ${siteId}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E2A\u0E37\u0E48\u0E2D");
    const nextOrder = (site.assets.filter((asset) => asset.kind === input.kind).at(-1)?.sortOrder ?? -1) + 1;
    const created = {
      id: repository.nextAssetId++,
      siteId,
      kind: input.kind,
      storageKey: uploaded.key,
      url: uploaded.url,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sortOrder: nextOrder,
      byteLength: input.bytes.byteLength,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    site.assets.push(created);
    site.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    return { data: repository, result: toClientAsset(created) };
  });
}
async function deleteMediaAsset(siteId, id) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: remove media ${id}`, (repository) => {
    const site = getSite(repository, siteId);
    if (!site) return { data: repository, result: { success: false } };
    const assetIndex = site.assets.findIndex((asset) => asset.id === id);
    if (assetIndex === -1) return { data: repository, result: { success: false } };
    if (site.assets[assetIndex].kind === "audio" && site.settings.musicUrl === site.assets[assetIndex].url) {
      site.settings.musicUrl = "";
      site.settings.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    site.assets.splice(assetIndex, 1);
    site.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    return { data: repository, result: { success: true } };
  });
}
async function updateMediaOrder(siteId, id, sortOrder) {
  return updateJson(SITE_DATA_PATH, emptyRepository, `anniversary: reorder media ${id}`, (repository) => {
    const site = getSite(repository, siteId);
    const asset = site?.assets.find((item) => item.id === id);
    if (!site || !asset) return { data: repository, result: { success: false } };
    asset.sortOrder = sortOrder;
    site.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    return { data: repository, result: { success: true } };
  });
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId: isNonEmptyString(appId) ? appId : "",
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/ownerAuth.ts
function isOwnerPasswordValid(password) {
  const configuredPassword = process.env.OWNER_LOGIN_PASSWORD;
  if (typeof password !== "string" || !configuredPassword) return false;
  const candidate = Buffer.from(password, "utf8");
  const expected = Buffer.from(configuredPassword, "utf8");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
async function issueOwnerSession(req, res) {
  if (!ENV.ownerOpenId) {
    throw new Error("owner login is not configured");
  }
  const owner = await getUserByOpenId(ENV.ownerOpenId);
  if (!owner || owner.role !== "admin") {
    throw new Error("owner account is not available");
  }
  const sessionToken = await sdk.createSessionToken(owner.openId, {
    name: owner.name || "Owner",
    expiresInMs: ONE_YEAR_MS
  });
  res.cookie(COOKIE_NAME, sessionToken, {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS
  });
  return { success: true };
}
function registerOwnerPasswordAuthRoutes(app) {
  app.post("/api/owner-auth/login", async (req, res) => {
    try {
      if (!isOwnerPasswordValid(req.body?.password)) {
        res.status(401).json({ error: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
        return;
      }
      const result = await issueOwnerSession(req, res);
      res.status(200).json(result);
    } catch (error) {
      console.error("[OwnerAuth] Login failed", error);
      res.status(500).json({ error: "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E14\u0E49" });
    }
  });
  app.post("/api/owner-auth/logout", (req, res) => {
    res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
    res.status(200).json({ success: true });
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers/site.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";

// server/email.ts
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}
function buildLoveOfficeEmailHtml(message) {
  return `<main style="max-width:560px;margin:0 auto;padding:32px;background:#fff7fb;color:#31202c;font-family:Arial,sans-serif"><div style="padding:28px;border:1px solid #f9a8d4;border-radius:20px;background:#fff"><p style="margin:0 0 14px;color:#db2777;font-weight:700">LoveOffice</p><div style="font-size:16px;line-height:1.75;white-space:normal">${escapeHtml(message).replace(/\n/g, "<br />")}</div></div></main>`;
}
async function sendLoveOfficeEmail(input, request2 = fetch) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 Resend API key");
  const from = process.env.RESEND_FROM_EMAIL || "LoveOffice <onboarding@resend.dev>";
  const response = await request2("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.message, html: buildLoveOfficeEmailHtml(input.message) })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.name || "\u0E2A\u0E48\u0E07\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
  return { id: payload.id ?? "" };
}

// server/routers/site.ts
var slugSchema = z2.string().trim().min(3).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "\u0E43\u0E0A\u0E49\u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29 \u0E15\u0E31\u0E27\u0E40\u0E25\u0E02 \u0E41\u0E25\u0E30\u0E02\u0E35\u0E14\u0E01\u0E25\u0E32\u0E07\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19");
var siteInput = z2.object({ slug: slugSchema });
var optionalHttpUrl = z2.string().url().refine((value) => /^https?:\/\//i.test(value), "\u0E43\u0E0A\u0E49\u0E25\u0E34\u0E07\u0E01\u0E4C http \u0E2B\u0E23\u0E37\u0E2D https \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19").or(z2.literal(""));
var optionalStoredMusicUrl = z2.string().trim().max(2048).refine((value) => !value || /^\/manus-storage\/[a-zA-Z0-9._/-]+$/.test(value), "\u0E40\u0E1E\u0E25\u0E07\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E32\u0E08\u0E32\u0E01\u0E44\u0E1F\u0E25\u0E4C\u0E17\u0E35\u0E48\u0E2D\u0E31\u0E1B\u0E42\u0E2B\u0E25\u0E14\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19");
var timelineEntryInput = z2.object({ id: z2.string().min(1).max(80), title: z2.string().trim().min(1).max(120), date: z2.string().max(32), description: z2.string().trim().max(1e3) });
var placeEntryInput = z2.object({ id: z2.string().min(1).max(80), name: z2.string().trim().min(1).max(120), mapUrl: optionalHttpUrl });
var storyNoteInput = z2.object({ id: z2.string().min(1).max(80), title: z2.string().trim().min(1).max(120), body: z2.string().trim().max(3e3), publishAt: z2.string().max(32) });
var featureInput = z2.object({
  songLabel: z2.string().trim().max(120),
  welcomeTitle: z2.string().trim().max(160),
  welcomeMessage: z2.string().trim().max(1e3),
  fontFamily: z2.enum(["gaegu", "serif", "sans"]),
  customFontUrl: z2.string().max(2048),
  customFontName: z2.string().max(255),
  backgroundStyle: z2.enum(["soft", "sunset", "night", "paper"]),
  themeMode: z2.enum(["light", "night", "auto"]),
  visualTheme: z2.enum(["soft-love", "minimal-white", "midnight-date", "film-diary", "lavender-dream", "sunset-memory"]),
  hideVideos: z2.boolean(),
  hideGallery: z2.boolean(),
  hideMessage: z2.boolean(),
  surpriseTitle: z2.string().trim().max(160),
  surpriseMessage: z2.string().trim().max(1500),
  surpriseAt: z2.string().max(32),
  timeline: z2.array(timelineEntryInput).max(30),
  places: z2.array(placeEntryInput).max(20),
  notes: z2.array(storyNoteInput).max(30),
  ownerNote: z2.string().trim().max(3e3)
});
var settingsInput = z2.object({
  slug: slugSchema,
  facebookUrl: optionalHttpUrl,
  instagramUrl: optionalHttpUrl,
  musicUrl: optionalStoredMusicUrl,
  themeColor: z2.string().regex(/^#[0-9a-fA-F]{6}$/, "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E23\u0E2B\u0E31\u0E2A\u0E2A\u0E35\u0E41\u0E1A\u0E1A #RRGGBB"),
  pin: z2.string().regex(/^\d{4}$/).optional(),
  features: featureInput
});
var sendEmailInput = z2.object({ slug: slugSchema, to: z2.string().trim().email("\u0E01\u0E23\u0E2D\u0E01\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E43\u0E2B\u0E49\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07").max(254), subject: z2.string().trim().min(1, "\u0E01\u0E23\u0E2D\u0E01\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E2D\u0E35\u0E40\u0E21\u0E25").max(160), message: z2.string().trim().min(1, "\u0E01\u0E23\u0E2D\u0E01\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E2A\u0E48\u0E07").max(5e3) });
async function requireOwnedSite(ownerId, slug) {
  const site = await getOwnedSiteBySlug(ownerId, slug);
  if (!site) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E19\u0E35\u0E49 \u0E2B\u0E23\u0E37\u0E2D\u0E04\u0E38\u0E13\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E40\u0E02\u0E49\u0E32\u0E16\u0E36\u0E07" });
  return site;
}
var siteRouter = router({
  dashboard: router({
    list: protectedProcedure.query(({ ctx }) => listSitesForOwner(ctx.user.id)),
    create: protectedProcedure.input(z2.object({ title: z2.string().trim().min(1).max(160), slug: slugSchema })).mutation(async ({ ctx, input }) => {
      try {
        return await createSiteForOwner(ctx.user.id, input);
      } catch (error) {
        if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
          throw new TRPCError3({ code: "CONFLICT", message: "\u0E0A\u0E37\u0E48\u0E2D\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E19\u0E35\u0E49\u0E16\u0E39\u0E01\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E41\u0E25\u0E49\u0E27 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E2B\u0E21\u0E48" });
        }
        throw error;
      }
    }),
    remove: protectedProcedure.input(siteInput).mutation(async ({ ctx, input }) => {
      const result = await deleteSiteForOwner(ctx.user.id, input.slug);
      if (!result.success) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E19\u0E35\u0E49 \u0E2B\u0E23\u0E37\u0E2D\u0E04\u0E38\u0E13\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E25\u0E1A" });
      return result;
    })
  }),
  private: router({
    get: protectedProcedure.input(siteInput).query(async ({ ctx, input }) => {
      const data = await getPrivateSiteData(ctx.user.id, input.slug);
      if (!data) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E19\u0E35\u0E49 \u0E2B\u0E23\u0E37\u0E2D\u0E04\u0E38\u0E13\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E40\u0E02\u0E49\u0E32\u0E16\u0E36\u0E07" });
      return data;
    }),
    verifyPin: protectedProcedure.input(z2.object({ slug: slugSchema, pin: z2.string() })).mutation(async ({ ctx, input }) => {
      if (!isValidPin(input.pin)) return { valid: false };
      const site = await requireOwnedSite(ctx.user.id, input.slug);
      return { valid: await verifySitePin(site.id, input.pin) };
    }),
    recordView: protectedProcedure.input(siteInput).mutation(async ({ ctx, input }) => {
      const site = await requireOwnedSite(ctx.user.id, input.slug);
      return recordSiteView(site.id);
    })
  }),
  admin: router({
    get: protectedProcedure.input(siteInput).query(async ({ ctx, input }) => {
      const data = await getAdminSiteData(ctx.user.id, input.slug);
      if (!data) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E19\u0E35\u0E49 \u0E2B\u0E23\u0E37\u0E2D\u0E04\u0E38\u0E13\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E40\u0E02\u0E49\u0E32\u0E16\u0E36\u0E07" });
      return data;
    }),
    saveSettings: protectedProcedure.input(settingsInput).mutation(async ({ ctx, input }) => {
      const site = await requireOwnedSite(ctx.user.id, input.slug);
      return updateSiteSettings(site.id, input);
    }),
    sendEmail: protectedProcedure.input(sendEmailInput).mutation(async ({ ctx, input }) => {
      await requireOwnedSite(ctx.user.id, input.slug);
      return sendLoveOfficeEmail(input);
    }),
    uploadMedia: protectedProcedure.input(z2.object({ slug: slugSchema, kind: z2.enum(["image", "video", "audio"]), fileName: z2.string().trim().min(1).max(255), dataUrl: z2.string().min(20).max(36e5) })).mutation(async ({ ctx, input }) => {
      const site = await requireOwnedSite(ctx.user.id, input.slug);
      const { mimeType, bytes } = decodeDataUrl(input.dataUrl);
      if (!isAllowedMedia(input.kind, mimeType)) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0E0A\u0E19\u0E34\u0E14\u0E44\u0E1F\u0E25\u0E4C\u0E44\u0E21\u0E48\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E0A\u0E48\u0E2D\u0E07\u0E2D\u0E31\u0E1B\u0E42\u0E2B\u0E25\u0E14" });
      if (bytes.byteLength > 25e5) throw new TRPCError3({ code: "PAYLOAD_TOO_LARGE", message: "\u0E44\u0E1F\u0E25\u0E4C\u0E40\u0E01\u0E34\u0E19 2.5MB \u0E0B\u0E36\u0E48\u0E07\u0E40\u0E01\u0E34\u0E19\u0E02\u0E19\u0E32\u0E14\u0E17\u0E35\u0E48 Vercel \u0E23\u0E2D\u0E07\u0E23\u0E31\u0E1A\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E2D\u0E31\u0E1B\u0E42\u0E2B\u0E25\u0E14\u0E41\u0E1A\u0E1A\u0E19\u0E35\u0E49" });
      if (input.kind === "video" && (await listMediaAssets(site.id, "video")).length >= 4) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0E2D\u0E31\u0E1B\u0E42\u0E2B\u0E25\u0E14\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E44\u0E14\u0E49\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14 4 \u0E44\u0E1F\u0E25\u0E4C" });
      }
      const created = await createMediaAsset(site.id, { kind: input.kind, originalName: input.fileName, mimeType, bytes });
      if (input.kind === "audio") await setMusicUrl(site.id, created.url);
      return created;
    }),
    uploadFont: protectedProcedure.input(z2.object({ slug: slugSchema, fileName: z2.string().trim().min(1).max(255), dataUrl: z2.string().min(20).max(36e5) })).mutation(async ({ ctx, input }) => {
      const site = await requireOwnedSite(ctx.user.id, input.slug);
      const { mimeType, bytes } = decodeDataUrl(input.dataUrl);
      if (!isAllowedFont(input.fileName, mimeType)) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0E23\u0E2D\u0E07\u0E23\u0E31\u0E1A\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E44\u0E1F\u0E25\u0E4C WOFF, WOFF2, TTF \u0E2B\u0E23\u0E37\u0E2D OTF" });
      if (bytes.byteLength > 25e5) throw new TRPCError3({ code: "PAYLOAD_TOO_LARGE", message: "\u0E1F\u0E2D\u0E19\u0E15\u0E4C\u0E40\u0E01\u0E34\u0E19 2.5MB \u0E0B\u0E36\u0E48\u0E07\u0E40\u0E01\u0E34\u0E19\u0E02\u0E19\u0E32\u0E14\u0E17\u0E35\u0E48 Vercel \u0E23\u0E2D\u0E07\u0E23\u0E31\u0E1A\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E2D\u0E31\u0E1B\u0E42\u0E2B\u0E25\u0E14\u0E41\u0E1A\u0E1A\u0E19\u0E35\u0E49" });
      return uploadCustomFont(site.id, { originalName: input.fileName, mimeType: fontMimeTypeFromFileName(input.fileName, mimeType), bytes });
    }),
    removeMedia: protectedProcedure.input(z2.object({ slug: slugSchema, id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const site = await requireOwnedSite(ctx.user.id, input.slug);
      return deleteMediaAsset(site.id, input.id);
    }),
    reorderMedia: protectedProcedure.input(z2.object({ slug: slugSchema, id: z2.number().int().positive(), sortOrder: z2.number().int().min(0) })).mutation(async ({ ctx, input }) => {
      const site = await requireOwnedSite(ctx.user.id, input.slug);
      return updateMediaOrder(site.id, input.id, input.sortOrder);
    })
  })
});

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure.input(z3.object({ password: z3.string().min(1).max(256) })).mutation(async ({ ctx, input }) => {
      if (!isOwnerPasswordValid(input.password)) {
        throw new TRPCError4({ code: "UNAUTHORIZED", message: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
      }
      try {
        return await issueOwnerSession(ctx.req, ctx.res);
      } catch (error) {
        console.error("[OwnerAuth] Login failed", error);
        throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E14\u0E49" });
      }
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  site: siteRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get(["/manus-storage/*", "/api/manus-storage/*"], async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/_core/app.ts
function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOwnerPasswordAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app;
}

// server/_core/vercelEntry.ts
var vercelEntry_default = createApp();
export {
  vercelEntry_default as default
};
