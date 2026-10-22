import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { ENV } from "./env";
import { purgeExpiredSites } from "../db";
import { writeBinary } from "../githubStorage";

/**
 * Shared Express application for the local server and Vercel's serverless handler.
 * Static frontend serving remains runtime-specific; API paths stay identical.
 */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  app.put("/api/media-upload", express.raw({ type: () => true, limit: "100mb" }), async (req, res) => {
    const key = typeof req.query.key === "string" ? req.query.key : "";
    if (!key || !/^anniversary\/[\w./-]+$/.test(key)) { res.status(400).send("Invalid media key"); return; }
    try {
      await writeBinary(`media/${key}`, req.body as Buffer, `media: add ${key}`);
      res.status(200).json({ ok: true });
    } catch (error) { console.error("[MediaUpload] failed", error); res.status(500).send("Media upload failed"); }
  });
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.get("/api/cron/purge-expired", async (req, res) => {
    const authorization = req.headers.authorization;
    if (!ENV.cronSecret || authorization !== `Bearer ${ENV.cronSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const result = await purgeExpiredSites();
      res.json({ ok: true, deleted: result.deleted });
    } catch (error) {
      console.error("[Expiry] purge failed", error);
      res.status(500).json({ error: "Expiry cleanup failed" });
    }
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );
  return app;
}
