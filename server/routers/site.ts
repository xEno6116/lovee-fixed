import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createMediaAsset,
  createSiteForOwner,
  deleteMediaAsset,
  deleteSiteForOwner,
  getAdminSiteData,
  getQuestionLetterBySlug,
  getOwnedSiteBySlug,
  getPrivateSiteData,
  getVisitorSiteData,
  getVisitorSiteIdBySlug,
  type FeatureSettings,
  listMediaAssets,
  recordSiteView,
  uploadCustomFont,
  listSitesForOwner,
  setMusicUrl,
  updateMediaOrder,
  updateSiteSettings,
  verifySitePin,
} from "../db";
import { decodeDataUrl, fontMimeTypeFromFileName, isAllowedFont, isAllowedMedia, isValidPin } from "../siteUtils";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { sendLoveOfficeEmail } from "../email";
import { inspectLetterResponse, recordLetterResponse } from "../letterResponse";
import { getSessionCookieOptions } from "../_core/cookies";
import { createVisitorAccessToken, getVisitorSiteId, visitorAccessMaxAgeSeconds, VISITOR_ACCESS_COOKIE } from "../visitorAccess";

const slugSchema = z.string().trim().min(3).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "ใช้ตัวอักษรอังกฤษ ตัวเลข และขีดกลางเท่านั้น");
const siteInput = z.object({ slug: slugSchema });
const optionalHttpUrl = z.string().url().refine((value) => /^https?:\/\//i.test(value), "ใช้ลิงก์ http หรือ https เท่านั้น").or(z.literal(""));
const optionalStoredMusicUrl = z.string().trim().max(2048).refine((value) => !value || /^\/manus-storage\/[a-zA-Z0-9._/-]+$/.test(value), "เพลงต้องมาจากไฟล์ที่อัปโหลดในระบบเท่านั้น");
const timelineEntryInput = z.object({ id: z.string().min(1).max(80), title: z.string().trim().min(1).max(120), date: z.string().max(32), description: z.string().trim().max(1000) });
const placeEntryInput = z.object({ id: z.string().min(1).max(80), name: z.string().trim().min(1).max(120), mapUrl: optionalHttpUrl });
const storyNoteInput = z.object({ id: z.string().min(1).max(80), title: z.string().trim().min(1).max(120), body: z.string().trim().max(3000), publishAt: z.string().max(32) });
const featureInput = z.object({
  songLabel: z.string().trim().max(120), welcomeTitle: z.string().trim().max(160), welcomeMessage: z.string().trim().max(1000),
  fontFamily: z.enum(["gaegu", "serif", "sans"]), customFontUrl: z.string().max(2048), customFontName: z.string().max(255), backgroundStyle: z.enum(["soft", "sunset", "night", "paper"]), themeMode: z.enum(["light", "night", "auto"]), visualTheme: z.enum(["soft-love", "minimal-white", "midnight-date", "film-diary", "lavender-dream", "sunset-memory"]), questionLetterEnabled: z.boolean(), questionLetterTitle: z.string().trim().max(160), questionLetterPrompt: z.string().trim().max(1_000), questionLetterRecipient: z.string().trim().email("กรอกอีเมลรับคำตอบให้ถูกต้อง").or(z.literal("")),
  hideVideos: z.boolean(), hideGallery: z.boolean(), hideMessage: z.boolean(), surpriseTitle: z.string().trim().max(160), surpriseMessage: z.string().trim().max(1500), surpriseAt: z.string().max(32),
  timeline: z.array(timelineEntryInput).max(30), places: z.array(placeEntryInput).max(20), notes: z.array(storyNoteInput).max(30), ownerNote: z.string().trim().max(3000),
});
const settingsInput = z.object({
  slug: slugSchema,
  facebookUrl: optionalHttpUrl,
  instagramUrl: optionalHttpUrl,
  musicUrl: optionalStoredMusicUrl,
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "เลือกรหัสสีแบบ #RRGGBB"),
  pin: z.string().regex(/^\d{4}$/).optional(),
  features: featureInput,
});
const sendEmailInput = z.object({ slug: slugSchema, to: z.string().trim().email("กรอกอีเมลผู้รับให้ถูกต้อง").max(254), subject: z.string().trim().min(1, "กรอกหัวข้ออีเมล").max(160), message: z.string().trim().min(1, "กรอกข้อความที่ต้องการส่ง").max(5_000) });
const letterResponseInput = z.object({ slug: slugSchema, answer: z.string().trim().min(1, "กรอกคำตอบก่อนส่ง").max(2_000), startedAt: z.number().finite(), honeypot: z.string().max(100).optional() });

async function requireOwnedSite(ownerId: number, slug: string) {
  const site = await getOwnedSiteBySlug(ownerId, slug);
  if (!site) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบเว็บไซต์นี้ หรือคุณไม่มีสิทธิ์เข้าถึง" });
  return site;
}

export const siteRouter = router({
  public: router({
    get: publicProcedure
      .input(siteInput)
      .query(async ({ ctx, input }) => {
        const siteId = await getVisitorSiteId(ctx.req);
        if (!siteId) throw new TRPCError({ code: "UNAUTHORIZED", message: "กรุณาใส่ PIN เพื่อเปิดความทรงจำ" });
        const data = await getVisitorSiteData(siteId, input.slug);
        if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบเว็บไซต์นี้" });
        return data;
      }),
    unlock: publicProcedure
      .input(z.object({ slug: slugSchema, pin: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!isValidPin(input.pin)) return { valid: false };
        const siteId = await getVisitorSiteIdBySlug(input.slug);
        if (!siteId || !(await verifySitePin(siteId, input.pin))) return { valid: false };
        const token = await createVisitorAccessToken(siteId);
        ctx.res.cookie(VISITOR_ACCESS_COOKIE, token, { ...getSessionCookieOptions(ctx.req), maxAge: visitorAccessMaxAgeSeconds * 1_000 });
        return { valid: true };
      }),
    recordView: publicProcedure
      .input(siteInput)
      .mutation(async ({ ctx, input }) => {
        const siteId = await getVisitorSiteId(ctx.req);
        if (!siteId || !(await getVisitorSiteData(siteId, input.slug))) throw new TRPCError({ code: "UNAUTHORIZED", message: "ไม่พบสิทธิ์เข้าถึงเว็บไซต์" });
        return recordSiteView(siteId);
      }),
    submitLetterResponse: publicProcedure
      .input(letterResponseInput)
      .mutation(async ({ ctx, input }) => {
        const siteId = await getVisitorSiteId(ctx.req);
        if (!siteId || !(await getVisitorSiteData(siteId, input.slug))) throw new TRPCError({ code: "UNAUTHORIZED", message: "กรุณาใส่ PIN ก่อนส่งคำตอบ" });
        const visitorKey = (ctx.req.header("x-forwarded-for") || ctx.req.ip || "unknown").split(",")[0].trim();
        const inspection = inspectLetterResponse(input, `${input.slug}:${visitorKey}`);
        if (inspection.silent) return { success: true };
        if (!inspection.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: inspection.reason });
        const letter = await getQuestionLetterBySlug(input.slug);
        if (!letter?.enabled || !letter.recipient) throw new TRPCError({ code: "NOT_FOUND", message: "จดหมายคำถามนี้ยังไม่เปิดรับคำตอบ" });
        recordLetterResponse(`${input.slug}:${visitorKey}`);
        await sendLoveOfficeEmail({ to: letter.recipient, subject: `คำตอบจดหมายจาก ${letter.siteTitle}`, message: `คำถาม: ${letter.prompt}\n\nคำตอบที่ได้รับ:\n${input.answer}` });
        return { success: true };
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
      .input(z.object({ slug: slugSchema, pin: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!isValidPin(input.pin)) return { valid: false };
        const site = await requireOwnedSite(ctx.user.id, input.slug);
        return { valid: await verifySitePin(site.id, input.pin) };
      }),
    recordView: protectedProcedure
      .input(siteInput)
      .mutation(async ({ ctx, input }) => {
        const site = await requireOwnedSite(ctx.user.id, input.slug);
        return recordSiteView(site.id);
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
        return updateSiteSettings(site.id, { ...input, features: input.features as FeatureSettings });
      }),
    sendEmail: protectedProcedure
      .input(sendEmailInput)
      .mutation(async ({ ctx, input }) => {
        await requireOwnedSite(ctx.user.id, input.slug);
        return sendLoveOfficeEmail(input);
      }),
    uploadMedia: protectedProcedure
      .input(z.object({ slug: slugSchema, kind: z.enum(["image", "video", "audio"]), fileName: z.string().trim().min(1).max(255), dataUrl: z.string().min(20).max(3_600_000) }))
      .mutation(async ({ ctx, input }) => {
        const site = await requireOwnedSite(ctx.user.id, input.slug);
        const { mimeType, bytes } = decodeDataUrl(input.dataUrl);
        if (!isAllowedMedia(input.kind, mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "ชนิดไฟล์ไม่ตรงกับช่องอัปโหลด" });
        if (bytes.byteLength > 2_500_000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "ไฟล์เกิน 2.5MB ซึ่งเกินขนาดที่ Vercel รองรับสำหรับการอัปโหลดแบบนี้" });
        if (input.kind === "video" && (await listMediaAssets(site.id, "video")).length >= 4) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "อัปโหลดวิดีโอได้สูงสุด 4 ไฟล์" });
        }
        const created = await createMediaAsset(site.id, { kind: input.kind, originalName: input.fileName, mimeType, bytes });
        if (input.kind === "audio") await setMusicUrl(site.id, created.url);
        return created;
      }),
    uploadFont: protectedProcedure
      .input(z.object({ slug: slugSchema, fileName: z.string().trim().min(1).max(255), dataUrl: z.string().min(20).max(3_600_000) }))
      .mutation(async ({ ctx, input }) => {
        const site = await requireOwnedSite(ctx.user.id, input.slug);
        const { mimeType, bytes } = decodeDataUrl(input.dataUrl);
        if (!isAllowedFont(input.fileName, mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "รองรับเฉพาะไฟล์ WOFF, WOFF2, TTF หรือ OTF" });
        if (bytes.byteLength > 2_500_000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "ฟอนต์เกิน 2.5MB ซึ่งเกินขนาดที่ Vercel รองรับสำหรับการอัปโหลดแบบนี้" });
        return uploadCustomFont(site.id, { originalName: input.fileName, mimeType: fontMimeTypeFromFileName(input.fileName, mimeType), bytes });
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
