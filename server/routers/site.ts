import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createMediaAsset,
  createSiteForOwner,
  finalizeMediaAsset,
  deleteMediaAsset,
  deleteSiteForOwner,
  getAdminSiteData,
  getOwnedSiteBySlug,
  getPrivateSiteData,
  listMediaAssets,
  listSitesForOwner,
  prepareMediaUpload,
  setMusicUrl,
  updateMediaOrder,
  updateSiteSettings,
  verifySitePin,
} from "../db";
import { decodeDataUrl, isAllowedMedia, isValidPin } from "../siteUtils";
import { protectedProcedure, router } from "../_core/trpc";

const slugSchema = z.string().trim().min(3).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "ใช้ตัวอักษรอังกฤษ ตัวเลข และขีดกลางเท่านั้น");
const siteInput = z.object({ slug: slugSchema });
const settingsInput = z.object({
  slug: slugSchema,
  memoryMessage: z.string().trim().min(1).max(5000),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pin: z.string().regex(/^\d{4}$/).optional(),
  musicUrl: z.string().url().or(z.literal("")),
});

async function requireOwnedSite(ownerId: number, slug: string) {
  const site = await getOwnedSiteBySlug(ownerId, slug);
  if (!site) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบเว็บไซต์นี้ หรือคุณไม่มีสิทธิ์เข้าถึง" });
  return site;
}

export const siteRouter = router({
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
