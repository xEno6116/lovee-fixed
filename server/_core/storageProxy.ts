import type { Express } from "express";
import { ENV } from "./env";
import { readBinary } from "../githubStorage";

export function registerStorageProxy(app: Express) {
  app.get(["/manus-storage/*", "/api/manus-storage/*"], async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      try {
        const response = await readBinary(`media/${key}`);
        res.set("Cache-Control", "public, max-age=31536000, immutable");
        if (response.headers.get("content-type")) res.set("Content-Type", response.headers.get("content-type")!);
        res.status(response.status);
        res.send(Buffer.from(await response.arrayBuffer()));
      } catch { res.status(404).send("Media not found"); }
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
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
