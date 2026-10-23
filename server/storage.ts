// Cloud storage abstraction. Custom S3/R2 is preferred when configured;
// Manus Forge storage remains the safe fallback for existing deployments.
import { PutObjectCommand, S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";
import { writeBinary } from "./githubStorage";

function hasCustomS3() {
  return Boolean(ENV.s3Bucket && ENV.s3AccessKeyId && ENV.s3SecretAccessKey && ENV.s3PublicBaseUrl);
}

function getS3Client() {
  return new S3Client({
    region: ENV.s3Region || "auto",
    endpoint: ENV.s3Endpoint || undefined,
    forcePathStyle: ENV.s3ForcePathStyle,
    credentials: { accessKeyId: ENV.s3AccessKeyId, secretAccessKey: ENV.s3SecretAccessKey },
  });
}

function normalizeKey(relKey: string): string { return relKey.replace(/^\/+/, ""); }
function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
function publicS3Url(key: string) { return `${ENV.s3PublicBaseUrl.replace(/\/+$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`; }
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) throw new Error("Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY");
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

export async function storagePrepareUpload(relKey: string, contentType = "application/octet-stream"): Promise<{ key: string; uploadUrl: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  if (hasCustomS3()) {
    const uploadUrl = await getSignedUrl(getS3Client(), new PutObjectCommand({ Bucket: ENV.s3Bucket, Key: key, ContentType: contentType }), { expiresIn: 900 });
    return { key, uploadUrl, url: publicS3Url(key) };
  }
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) return { key, uploadUrl: `/api/media-upload?key=${encodeURIComponent(key)}`, url: `/api/media-download?key=${encodeURIComponent(key)}` };
  const { forgeUrl, forgeKey } = getForgeConfig();
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key); presignUrl.searchParams.set("contentType", contentType);
  const presignResp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!presignResp.ok) throw new Error(`Storage presign failed (${presignResp.status})`);
  const { url: uploadUrl } = await presignResp.json() as { url: string };
  if (!uploadUrl) throw new Error("Forge returned empty presign URL");
  return { key, uploadUrl, url: `/manus-storage/${key}` };
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream"): Promise<{ key: string; url: string }> {
  const { key, uploadUrl, url } = await storagePrepareUpload(relKey, contentType);
  if (hasCustomS3()) {
    await getS3Client().send(new PutObjectCommand({ Bucket: ENV.s3Bucket, Key: key, Body: typeof data === "string" ? Buffer.from(data) : data, ContentType: contentType }));
    return { key, url };
  }
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    await writeBinary(`media/${key}`, typeof data === "string" ? Buffer.from(data) : Buffer.from(data), `media: add ${key}`);
    return { key, url };
  }
  const body = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as any], { type: contentType });
  const uploadResp = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body });
  if (!uploadResp.ok) throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: hasCustomS3() ? publicS3Url(key) : `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  if (hasCustomS3()) return getSignedUrl(getS3Client(), new GetObjectCommand({ Bucket: ENV.s3Bucket, Key: key }), { expiresIn: 900 });
  const { forgeUrl, forgeKey } = getForgeConfig();
  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/"); getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!resp.ok) throw new Error(`Storage signed URL failed (${resp.status})`);
  const { url } = await resp.json() as { url: string };
  return url;
}

export function storageProviderName() { return hasCustomS3() ? "custom-s3" : ENV.forgeApiUrl ? "manus-s3" : "github-fallback"; }
