import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { issueOwnerSession, validateOwnerPasscodeAttempt } from "./_core/ownerAuth";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { siteRouter } from "./routers/site";

export const ownerPasscodeInput = z.object({
  passcode: z.string().regex(/^\d{6,12}$/).optional(),
  password: z.string().regex(/^\d{6,12}$/).optional(),
}).optional().transform((value, ctx) => {
  const passcode = value?.passcode ?? value?.password;
  if (!passcode) {
    ctx.addIssue({ code: "custom", message: "กรุณากรอกรหัสตัวเลข 6–12 หลัก" });
    return z.NEVER;
  }
  return { passcode };
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure.input(ownerPasscodeInput).mutation(async ({ ctx, input }) => {
      const attempt = await validateOwnerPasscodeAttempt(ctx.req, input.passcode);
      if (!attempt.allowed) {
        throw new TRPCError({
          code: attempt.locked ? "TOO_MANY_REQUESTS" : "UNAUTHORIZED",
          message: attempt.locked ? `ลองรหัสผิดหลายครั้ง กรุณาลองใหม่ใน ${Math.max(1, Math.ceil(attempt.retryAfterSeconds / 60))} นาที` : "รหัสตัวเลขไม่ถูกต้อง",
        });
      }
      try {
        return await issueOwnerSession(ctx.req, ctx.res);
      } catch (error) {
        console.error("[OwnerAuth] Passcode login failed", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ไม่สามารถเข้าสู่ระบบได้" });
      }
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  site: siteRouter,
});

export type AppRouter = typeof appRouter;
