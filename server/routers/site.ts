import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createMediaAsset,
  deleteMediaAsset,
  getAdminSiteData,
  getPublicSiteData,
  listMediaAssets,
  setMusicUrl,
  updateMediaOrder,
  updateSiteSettings,
} from "../db";
import { decodeDataUrl, isAllowedMedia, isValidPin } from "../siteUtils";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "เฉพาะเจ้าของเว็บไซต์เท่านั้น" });
  }
  return next();
});

const settingsInput = z.object({
  memoryMessage: z.string().trim().min(1).max(5000),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pin: z.string().regex(/^\d{4}$/).optional(),
  musicUrl: z.string().url().or(z.literal("")),
  birthdayGreeting: z.string().trim().min(1).max(240),
  birthdayWishes: z.string().trim().min(1).max(5000),
});

export const siteRouter = router({
  public: router({
    get: publicProcedure.query(() => getPublicSiteData()),
    verifyPin: publicProcedure
      .input(z.object({ pin: z.string() }))
      .mutation(async ({ input }) => {
        if (!isValidPin(input.pin)) return { valid: false };
        const site = await getPublicSiteData();
        const { verifyPin } = await import("../db");
        return { valid: await verifyPin(input.pin, site.settings.id) };
      }),
  }),
  admin: router({
    get: adminProcedure.query(() => getAdminSiteData()),
    saveSettings: adminProcedure
      .input(settingsInput)
      .mutation(({ input }) => updateSiteSettings(input)),
    uploadMedia: adminProcedure
      .input(
        z.object({
          kind: z.enum(["image", "video", "audio"]),
          fileName: z.string().trim().min(1).max(255),
          dataUrl: z.string().min(20).max(42_000_000),
        }),
      )
      .mutation(async ({ input }) => {
        const { mimeType, bytes } = decodeDataUrl(input.dataUrl);
        if (!isAllowedMedia(input.kind, mimeType)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ชนิดไฟล์ไม่ตรงกับช่องอัปโหลด" });
        }
        if (bytes.byteLength > 30 * 1024 * 1024) {
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "ไฟล์มีขนาดเกิน 30MB" });
        }
        if (input.kind === "video") {
          const videos = await listMediaAssets("video");
          if (videos.length >= 4) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "อัปโหลดวิดีโอได้สูงสุด 4 ไฟล์" });
          }
        }
        const created = await createMediaAsset({
          kind: input.kind,
          originalName: input.fileName,
          mimeType,
          bytes,
        });
        if (input.kind === "audio") await setMusicUrl(created.url);
        return created;
      }),
    removeMedia: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteMediaAsset(input.id)),
    reorderMedia: adminProcedure
      .input(z.object({ id: z.number().int().positive(), sortOrder: z.number().int().min(0) }))
      .mutation(({ input }) => updateMediaOrder(input.id, input.sortOrder)),
  }),
});
