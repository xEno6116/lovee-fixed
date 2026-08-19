import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { isOwnerPasswordValid, issueOwnerSession } from "./_core/ownerAuth";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { siteRouter } from "./routers/site";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure.input(z.object({ password: z.string().min(1).max(256) })).mutation(async ({ ctx, input }) => {
      if (!isOwnerPasswordValid(input.password)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "รหัสผ่านไม่ถูกต้อง" });
      }
      try {
        return await issueOwnerSession(ctx.req, ctx.res);
      } catch (error) {
        console.error("[OwnerAuth] Login failed", error);
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
