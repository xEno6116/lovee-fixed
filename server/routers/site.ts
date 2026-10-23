import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createMediaAsset,
  createSiteForOwner,
  finalizeMediaAsset,
  deleteMediaAsset,
  deleteSiteForOwner,
  getAdminSiteData,
  getPublicSitePreview,
  getOwnedSiteBySlug,
  getPrivateSiteData,
  getSiteForLetter,
  listMediaAssets,
  listSitesForOwner,
  prepareMediaUpload,
  setMusicUrl,
  unlockPublicSite,
  updateMediaOrder,
  updateSiteSettings,
  verifySitePin,
} from "../db";
import { decodeDataUrl, isAllowedMedia, isValidPin } from "../siteUtils";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { sendMemoryLetter } from "../email";

const slugSchema = z.string().trim().min(3).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "ใช้ตัวอักษรอังกฤษ ตัวเลข และขีดกลางเท่านั้น");
const siteInput = z.object({ slug: slugSchema });
const settingsInput = z.object({
  slug: slugSchema,
  memoryMessage: z.string().trim().min(1).max(5000),
  secretMessage: z.string().max(5000).optional(),
  startDate: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
  pin: z.string().regex(/^\d{4}$/).optional(),
  musicUrl: z.string().url().or(z.literal("")),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundStyle: z.enum(["soft", "sunset", "night", "paper"]).optional(),
  themeMode: z.enum(["light", "night"]).optional(),
  fontFamily: z.enum(["gaegu", "serif", "sans"]).optional(),
  letterRecipientEmail: z.string().email("กรุณาใส่อีเมลผู้รับให้ถูกต้อง").or(z.literal("")).optional(),
  layoutOrder: z.array(z.enum(["video", "message", "secret", "gallery", "letter"])).length(5).optional(),
  hiddenSections: z.array(z.enum(["video", "message", "secret", "gallery", "letter"])).optional(),
});

async function requireOwnedSite(ownerId: number, slug: string) {
  const site = await getOwnedSiteBySlug(ownerId, slug);
  if (!site) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบเว็บไซต์นี้ หรือคุณไม่มีสิทธิ์เข้าถึง" });
  return site;
}

  const pinAttempts = new Map<string, { count: number; resetAt: number }>();

function allowPinAttempt(key: string) {
  const now = Date.now();
  const current = pinAttempts.get(key);
  if (!current || current.resetAt <= now) {
    pinAttempts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 10) return false;
  current.count += 1;
  return true;
}

async function verifyRecaptcha(token?: string) {
  if (!ENV.recaptchaSecretKey) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret: ENV.recaptchaSecretKey, response: token });
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

export const siteRouter = router({
  public: router({
    get: publicProcedure
      .input(siteInput)
      .query(async ({ input }) => {
        const data = await getPublicSitePreview(input.slug);
        if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบเว็บไซต์นี้" });
        return data;
      }),
      unlock: publicProcedure
      .input(z.object({ slug: slugSchema, pin: z.string(), recaptchaToken: z.string().min(10).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!isValidPin(input.pin)) return { valid: false as const };
        const address = ctx.req?.ip || ctx.req?.headers["x-forwarded-for"]?.toString().split(",")[0] || "unknown";
        if (!allowPinAttempt(`${address}:${input.slug}`)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "ลอง PIN มากเกินไป กรุณารอ 1 นาที" });
        if (!(await verifyRecaptcha(input.recaptchaToken))) return { valid: false as const, bot: true as const };
        const data = await unlockPublicSite(input.slug, input.pin);
        return data ? { valid: true as const, data } : { valid: false as const };
      }),
    sendLetter: publicProcedure
      .input(z.object({ slug: slugSchema, senderName: z.string().trim().min(1).max(80), senderEmail: z.string().email().optional().or(z.literal("")), message: z.string().trim().min(3).max(5000) }))
      .mutation(async ({ ctx, input }) => {
        const address = ctx.req?.ip || ctx.req?.headers["x-forwarded-for"]?.toString().split(",")[0] || "unknown";
        if (!allowPinAttempt(`letter:${address}:${input.slug}`)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "ส่งจดหมายถี่เกินไป กรุณารอสักครู่" });
        const site = await getSiteForLetter(input.slug);
        if (!site) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "เจ้าของเว็บไซต์ยังไม่ได้ตั้งค่าอีเมลผู้รับ" });
        try {
          return await sendMemoryLetter({ ...input, siteTitle: site.title, to: site.recipientEmail });
        } catch (error) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "ส่งจดหมายไม่สำเร็จ" });
        }
      }),
  }),
  dashboard: router({
    list: protectedProcedure.query(({ ctx }) => listSitesForOwner(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({ title: z.string().trim().min(1).max(160), slug: slugSchema }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await createSiteForOwner(ctx.user.id, input);
        } catch (error) {
          if (error instanceof Error && /owner site limit/i.test(error.message)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "บัญชีนี้มีเว็บไซต์ฟรีครบ 1 เว็บแล้ว" });
          }
          if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
            throw new TRPCError({ code: "CONFLICT", message: "ชื่อลิงก์นี้ถูกใช้งานแล้ว กรุณาเลือกชื่อใหม่" });
          }
          throw error;
        }
      }),
    remove: protectedProcedure
      .input(siteInput)
      .mutation(async ({ ctx, input }) => {
        const result = await deleteSiteForOwner(ctx.user.id, input.slug);
        if (!result.success) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบเว็บไซต์นี้ หรือคุณไม่มีสิทธิ์ลบ" });
        return result;
      }),
  }),
  private: router({
    get: protectedProcedure
      .input(siteInput)
      .query(async ({ ctx, input }) => {
        const data = await getPrivateSiteData(ctx.user.id, input.slug);
        if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบเว็บไซต์นี้ หรือคุณไม่มีสิทธิ์เข้าถึง" });
        return data;
      }),
    verifyPin: protectedProcedure
      .input(z.object({ slug: slugSchema, pin: z.string(), recaptchaToken: z.string().min(10).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!isValidPin(input.pin)) return { valid: false };
        const address = ctx.req?.ip || ctx.req?.headers["x-forwarded-for"]?.toString().split(",")[0] || "unknown";
        if (!allowPinAttempt(`${address}:${input.slug}`)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "ลอง PIN มากเกินไป กรุณารอ 1 นาที" });
        if (!(await verifyRecaptcha(input.recaptchaToken))) return { valid: false, bot: true };
        const site = await requireOwnedSite(ctx.user.id, input.slug);
        const valid = await verifySitePin(site.id, input.pin);
        if (!valid) return { valid: false };
        const secretMessage = site.settings?.secretMessage ?? "";
        return secretMessage ? { valid: true, secretMessage } : { valid: true };
      }),
  }),
  admin: router({
    get: protectedProcedure
      .input(siteInput)
      .query(async ({ ctx, input }) => {
        const data = await getAdminSiteData(ctx.user.id, input.slug);
        if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบเว็บไซต์นี้ หรือคุณไม่มีสิทธิ์เข้าถึง" });
        return data;
      }),
    saveSettings: protectedProcedure
      .input(settingsInput)
      .mutation(async ({ ctx, input }) => {
        const site = await requireOwnedSite(ctx.user.id, input.slug);
        return updateSiteSettings(site.id, input);
      }),
    prepareUpload: protectedProcedure
      .input(z.object({ slug: slugSchema, kind: z.enum(["image", "video", "audio"]), fileName: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(3).max(120) }))
      .mutation(async ({ ctx, input }) => {
        const site = await requireOwnedSite(ctx.user.id, input.slug);
        if (!isAllowedMedia(input.kind, input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "ชนิดไฟล์ไม่ตรงกับช่องอัปโหลด" });
        if (input.kind === "video" && (await listMediaAssets(site.id, "video")).length >= 4) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "อัปโหลดวิดีโอได้สูงสุด 4 ไฟล์" });
        }
        return prepareMediaUpload(site.id, { kind: input.kind, originalName: input.fileName, mimeType: input.mimeType });
      }),
    finalizeUpload: protectedProcedure
      .input(z.object({ slug: slugSchema, kind: z.enum(["image", "video", "audio"]), fileName: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(3).max(120), key: z.string().trim().min(1).max(500), url: z.string().regex(/^\/manus-storage\//) }))
      .mutation(async ({ ctx, input }) => {
        const site = await requireOwnedSite(ctx.user.id, input.slug);
        if (!isAllowedMedia(input.kind, input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "ชนิดไฟล์ไม่ตรงกับช่องอัปโหลด" });
        const created = await finalizeMediaAsset(site.id, { kind: input.kind, originalName: input.fileName, mimeType: input.mimeType, key: input.key, url: input.url });
        if (input.kind === "audio") await setMusicUrl(site.id, created.url);
        return created;
      }),
    uploadMedia: protectedProcedure
      .input(z.object({ slug: slugSchema, kind: z.enum(["image", "video", "audio"]), fileName: z.string().trim().min(1).max(255), dataUrl: z.string().min(20).max(42_000_000) }))
      .mutation(async ({ ctx, input }) => {
        const site = await requireOwnedSite(ctx.user.id, input.slug);
        const { mimeType, bytes } = decodeDataUrl(input.dataUrl);
        if (!isAllowedMedia(input.kind, mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "ชนิดไฟล์ไม่ตรงกับช่องอัปโหลด" });
        if (bytes.byteLength > 30 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "ไฟล์มีขนาดเกิน 30MB" });
        if (input.kind === "video" && (await listMediaAssets(site.id, "video")).length >= 4) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "อัปโหลดวิดีโอได้สูงสุด 4 ไฟล์" });
        }
        const created = await createMediaAsset(site.id, { kind: input.kind, originalName: input.fileName, mimeType, bytes });
        if (input.kind === "audio") await setMusicUrl(site.id, created.url);
        return created;
      }),
    removeMedia: protectedProcedure
      .input(z.object({ slug: slugSchema, id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const site = await requireOwnedSite(ctx.user.id, input.slug);
        return deleteMediaAsset(site.id, input.id);
      }),
    reorderMedia: protectedProcedure
      .input(z.object({ slug: slugSchema, id: z.number().int().positive(), sortOrder: z.number().int().min(0) }))
      .mutation(async ({ ctx, input }) => {
        const site = await requireOwnedSite(ctx.user.id, input.slug);
        return updateMediaOrder(site.id, input.id, input.sortOrder);
      }),
  }),
});
