import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  cloneSiteForOwner,
  createSiteBackupForOwner,
  createMediaAsset,
  createSiteForOwner,
  deleteMediaAsset,
  deleteMediaAssets,
  deleteSiteForOwner,
  getDashboardOverviewForOwner,
  getAdminSiteData,
  getPublicSiteStatus,
  getQuestionLetterBySlug,
  getOwnedSiteBySlug,
  getPrivateSiteData,
  getVisitorSiteData,
  getVisitorSiteIdBySlug,
  type FeatureSettings,
  listMediaAssets,
  recordSiteLetterResponse,
  recordSiteView,
  restoreSiteBackupForOwner,
  setSiteAvailabilityForOwner,
  uploadCustomFont,
  listSitesForOwner,
  setMusicUrl,
  updateImageCaption,
  updateMediaOrder,
  updateSiteSettings,
  verifySitePin,
} from "../db";
import { getOwnerSecurityOverview } from "../adminSecurity";
import { decodeDataUrl, fontMimeTypeFromFileName, isAllowedFont, isAllowedMedia, isValidPin } from "../siteUtils";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { buildQuestionAnswerSummary, sendLoveOfficeEmail } from "../email";
import { inspectLetterResponse, recordLetterResponse } from "../letterResponse";
import { getSessionCookieOptions } from "../_core/cookies";
import { createLetterSubmissionToken, createVisitorAccessToken, getVisitorSiteId, hasSubmittedLetter, letterSubmissionMaxAgeSeconds, visitorAccessMaxAgeSeconds, LETTER_SUBMISSION_COOKIE, VISITOR_ACCESS_COOKIE } from "../visitorAccess";

const slugSchema = z.string().trim().min(3).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "ใช้ตัวอักษรอังกฤษ ตัวเลข และขีดกลางเท่านั้น");
const siteInput = z.object({ slug: slugSchema });
const optionalHttpUrl = z.string().url().refine((value) => /^https?:\/\//i.test(value), "ใช้ลิงก์ http หรือ https เท่านั้น").or(z.literal(""));
const optionalStoredMusicUrl = z.string().trim().max(2048).refine((value) => !value || /^\/manus-storage\/[a-zA-Z0-9._/-]+$/.test(value), "เพลงต้องมาจากไฟล์ที่อัปโหลดในระบบเท่านั้น");
const timelineEntryInput = z.object({ id: z.string().min(1).max(80), title: z.string().trim().min(1).max(120), date: z.string().max(32), description: z.string().trim().max(1000) });
const placeEntryInput = z.object({ id: z.string().min(1).max(80), name: z.string().trim().min(1).max(120), mapUrl: optionalHttpUrl });
const storyNoteInput = z.object({ id: z.string().min(1).max(80), title: z.string().trim().min(1).max(120), body: z.string().trim().max(3000), publishAt: z.string().max(32) });
const questionEntryInput = z.object({ id: z.string().trim().min(1).max(80), prompt: z.string().trim().min(1).max(500) });
const featureInput = z.object({
  songLabel: z.string().trim().max(120), puzzleImageId: z.number().int().nonnegative().default(0), uiLayout: z.enum(["soft-story", "polaroid-journal", "midnight-glass"]).default("soft-story"), ambientHeartsEnabled: z.boolean().default(true), sparklesEnabled: z.boolean().default(true), filmOverlayEnabled: z.boolean().default(false), secretGiftEnabled: z.boolean().default(true), secretGiftTitle: z.string().trim().max(160).default("กล่องของขวัญลับ"), secretGiftMessage: z.string().trim().max(1500).default("ขอบคุณที่เข้ามาในความทรงจำนี้นะ 💝"), easterEggEnabled: z.boolean().default(true), celebrationOnOpenEnabled: z.boolean().default(true), welcomeTitle: z.string().trim().max(160), welcomeMessage: z.string().trim().max(1000),
  fontFamily: z.enum(["gaegu", "serif", "sans"]), customFontUrl: z.string().max(2048), customFontName: z.string().max(255), backgroundStyle: z.enum(["soft", "sunset", "night", "paper"]), themeMode: z.enum(["light", "night", "auto"]), visualTheme: z.enum(["soft-love", "minimal-white", "midnight-date", "film-diary", "lavender-dream", "sunset-memory"]), questionLetterEnabled: z.boolean(), questionLetterTitle: z.string().trim().max(160), questionLetterPrompt: z.string().trim().max(1_000).optional(), questionLetterPrompts: z.array(questionEntryInput).max(10, "เพิ่มคำถามได้สูงสุด 10 ข้อ").refine((items) => new Set(items.map((item) => item.prompt)).size === items.length, "คำถามต้องไม่ซ้ำกัน"), questionLetterRecipient: z.string().trim().email("กรอกอีเมลรับคำตอบให้ถูกต้อง").or(z.literal("")),
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
const availabilityInput = z.object({ slug: slugSchema, isPaused: z.boolean(), pausedMessage: z.string().trim().max(500) });
const cloneSiteInput = z.object({ sourceSlug: slugSchema, title: z.string().trim().min(1).max(160), slug: slugSchema });
const backupAssetInput = z.object({ kind: z.enum(["image", "video", "audio"]), url: z.string().min(1).max(2_048), originalName: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(1).max(160), sortOrder: z.number().int().min(0), caption: z.string().trim().max(1_200).optional(), byteLength: z.number().int().min(0).optional() });
const backupInput = z.object({
  version: z.literal(2),
  exportedAt: z.string().datetime(),
  site: z.object({ title: z.string().trim().min(1).max(160), slug: slugSchema }),
  settings: z.object({ startDate: z.string().max(32), memoryMessage: z.string().trim().max(5_000), musicUrl: optionalStoredMusicUrl, facebookUrl: optionalHttpUrl.optional(), instagramUrl: optionalHttpUrl.optional(), themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), features: featureInput, revisionLog: z.array(z.object({ at: z.string(), label: z.string().max(200) })).max(20).optional() }),
  assets: z.array(backupAssetInput).max(300),
});
const letterResponseInput = z.object({
  slug: slugSchema,
  answers: z.array(z.object({ question: z.string().trim().min(1).max(500), answer: z.string().trim().min(1, "กรอกคำตอบก่อนส่ง").max(2_000) })).min(1).max(10),
  startedAt: z.number().finite(),
  honeypot: z.string().max(100).optional(),
});

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
        const publicStatus = await getPublicSiteStatus(input.slug);
        if (publicStatus?.isPaused) throw new TRPCError({ code: "FORBIDDEN", message: publicStatus.pausedMessage });
        const siteId = await getVisitorSiteId(ctx.req);
        if (!siteId) throw new TRPCError({ code: "UNAUTHORIZED", message: "กรุณาใส่ PIN เพื่อเปิดความทรงจำ" });
        const data = await getVisitorSiteData(siteId, input.slug);
        if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบเว็บไซต์นี้" });
        return { ...data, letterSubmitted: await hasSubmittedLetter(ctx.req, siteId) };
      }),
    unlock: publicProcedure
      .input(z.object({ slug: slugSchema, pin: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!isValidPin(input.pin)) return { valid: false };
        const publicStatus = await getPublicSiteStatus(input.slug);
        if (publicStatus?.isPaused) return { valid: false, paused: true, message: publicStatus.pausedMessage };
        const siteId = publicStatus?.siteId ?? await getVisitorSiteIdBySlug(input.slug);
        if (!siteId || !(await verifySitePin(siteId, input.pin))) return { valid: false };
        const token = await createVisitorAccessToken(siteId);
        ctx.res.cookie(VISITOR_ACCESS_COOKIE, token, { ...getSessionCookieOptions(ctx.req), maxAge: visitorAccessMaxAgeSeconds * 1_000 });
        return { valid: true };
      }),
    recordView: publicProcedure
      .input(siteInput)
      .mutation(async ({ ctx, input }) => {
        const publicStatus = await getPublicSiteStatus(input.slug);
        if (publicStatus?.isPaused) throw new TRPCError({ code: "FORBIDDEN", message: publicStatus.pausedMessage });
        const siteId = await getVisitorSiteId(ctx.req);
        if (!siteId || !(await getVisitorSiteData(siteId, input.slug))) throw new TRPCError({ code: "UNAUTHORIZED", message: "ไม่พบสิทธิ์เข้าถึงเว็บไซต์" });
        return recordSiteView(siteId);
      }),
    submitLetterResponse: publicProcedure
      .input(letterResponseInput)
      .mutation(async ({ ctx, input }) => {
        const publicStatus = await getPublicSiteStatus(input.slug);
        if (publicStatus?.isPaused) throw new TRPCError({ code: "FORBIDDEN", message: publicStatus.pausedMessage });
        const siteId = await getVisitorSiteId(ctx.req);
        if (!siteId || !(await getVisitorSiteData(siteId, input.slug))) throw new TRPCError({ code: "UNAUTHORIZED", message: "กรุณาใส่ PIN ก่อนส่งคำตอบ" });
        if (await hasSubmittedLetter(ctx.req, siteId)) return { success: true, alreadySubmitted: true };
        const visitorKey = (ctx.req.header("x-forwarded-for") || ctx.req.ip || "unknown").split(",")[0].trim();
        const inspection = inspectLetterResponse(input, `${input.slug}:${visitorKey}`);
        if (inspection.silent) return { success: true };
        if (!inspection.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: inspection.reason });
        const letter = await getQuestionLetterBySlug(input.slug);
        if (!letter?.enabled || !letter.recipient || !letter.prompts.length) throw new TRPCError({ code: "NOT_FOUND", message: "จดหมายคำถามนี้ยังไม่เปิดรับคำตอบ" });
        const answerByQuestion = new Map(input.answers.map((item) => [item.question, item.answer]));
        if (answerByQuestion.size !== letter.prompts.length || letter.prompts.some((item) => !answerByQuestion.has(item.prompt))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาตอบคำถามให้ครบทุกข้อก่อนส่ง" });
        }
        const answers = letter.prompts.map((item) => ({ question: item.prompt, answer: answerByQuestion.get(item.prompt) ?? "" }));
        await sendLoveOfficeEmail({ to: letter.recipient, subject: `คำตอบจดหมายจาก ${letter.siteTitle}`, message: buildQuestionAnswerSummary(answers) });
        await recordSiteLetterResponse(siteId);
        recordLetterResponse(`${input.slug}:${visitorKey}`);
        const submissionToken = await createLetterSubmissionToken(siteId);
        ctx.res.cookie(LETTER_SUBMISSION_COOKIE, submissionToken, { ...getSessionCookieOptions(ctx.req), maxAge: letterSubmissionMaxAgeSeconds * 1_000 });
        return { success: true, alreadySubmitted: false };
      }),
  }),
  dashboard: router({
    list: protectedProcedure.query(({ ctx }) => listSitesForOwner(ctx.user.id)),
    overview: protectedProcedure.query(({ ctx }) => getDashboardOverviewForOwner(ctx.user.id)),
    securityOverview: protectedProcedure.query(() => getOwnerSecurityOverview()),
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
    clone: protectedProcedure
      .input(cloneSiteInput)
      .mutation(async ({ ctx, input }) => {
        try {
          return await cloneSiteForOwner(ctx.user.id, input);
        } catch (error) {
          if (error instanceof Error && /duplicate|unique/i.test(error.message)) throw new TRPCError({ code: "CONFLICT", message: "ชื่อลิงก์นี้ถูกใช้งานแล้ว กรุณาเลือกชื่อใหม่" });
          if (error instanceof Error && /ไม่พบเว็บไซต์ต้นฉบับ/i.test(error.message)) throw new TRPCError({ code: "NOT_FOUND", message: error.message });
          throw error;
        }
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
        if (input.features.puzzleImageId) {
          const images = await listMediaAssets(site.id, "image");
          if (!images.some((image) => image.id === input.features.puzzleImageId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "เลือกรูปสำหรับจิ๊กซอจากรูปภาพของเว็บไซต์นี้เท่านั้น" });
          }
        }
        return updateSiteSettings(site.id, { ...input, features: input.features as FeatureSettings });
      }),
    setAvailability: protectedProcedure
      .input(availabilityInput)
      .mutation(async ({ ctx, input }) => {
        await requireOwnedSite(ctx.user.id, input.slug);
        const result = await setSiteAvailabilityForOwner(ctx.user.id, input.slug, input);
        if (!result.success) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบเว็บไซต์นี้ หรือคุณไม่มีสิทธิ์เข้าถึง" });
        return result;
      }),
    createBackup: protectedProcedure
      .input(siteInput)
      .query(async ({ ctx, input }) => {
        const backup = await createSiteBackupForOwner(ctx.user.id, input.slug);
        if (!backup) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบเว็บไซต์นี้ หรือคุณไม่มีสิทธิ์เข้าถึง" });
        return backup;
      }),
    restoreBackup: protectedProcedure
      .input(z.object({ slug: slugSchema, backup: backupInput }))
      .mutation(async ({ ctx, input }) => {
        const result = await restoreSiteBackupForOwner(ctx.user.id, input.slug, input.backup);
        if (!result.success) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบเว็บไซต์นี้ หรือคุณไม่มีสิทธิ์เข้าถึง" });
        return result;
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
    bulkRemoveMedia: protectedProcedure
      .input(z.object({ slug: slugSchema, ids: z.array(z.number().int().positive()).min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        const site = await requireOwnedSite(ctx.user.id, input.slug);
        return deleteMediaAssets(site.id, input.ids);
      }),
    reorderMedia: protectedProcedure
      .input(z.object({ slug: slugSchema, id: z.number().int().positive(), sortOrder: z.number().int().min(0) }))
      .mutation(async ({ ctx, input }) => {
        const site = await requireOwnedSite(ctx.user.id, input.slug);
        return updateMediaOrder(site.id, input.id, input.sortOrder);
      }),
    updateImageCaption: protectedProcedure
      .input(z.object({ slug: slugSchema, id: z.number().int().positive(), caption: z.string().trim().max(1_200, "ข้อความกำกับรูปยาวเกินไป") }))
      .mutation(async ({ ctx, input }) => {
        const site = await requireOwnedSite(ctx.user.id, input.slug);
        const result = await updateImageCaption(site.id, input.id, input.caption);
        if (!result.success) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบรูปภาพที่ต้องการแก้ไข" });
        return result;
      }),
  }),
});
