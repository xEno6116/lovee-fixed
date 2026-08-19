import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("Vercel deployment configuration", () => {
  it("keeps API and media paths out of the SPA fallback while supporting direct client routes", async () => {
    const config = JSON.parse(await readFile(path.join(projectRoot, "vercel.json"), "utf8")) as {
      outputDirectory?: string;
      routes?: Array<{ handle?: string; src?: string; dest?: string }>;
    };

    expect(config.outputDirectory).toBe("dist/public");
    expect(config.routes).toEqual([
      { src: "/api/(.*)", dest: "/api/[...path]" },
      { src: "/manus-storage/(.*)", dest: "/api/[...path]" },
      { handle: "filesystem" },
      { src: "/(.*)", dest: "/index.html" },
    ]);
  });
});
