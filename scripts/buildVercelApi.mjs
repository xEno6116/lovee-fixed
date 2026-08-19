import { build } from "esbuild";

await build({
  entryPoints: ["server/_core/vercelEntry.ts"],
  outfile: "api/[...path].js",
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  sourcemap: false,
  logLevel: "info",
});
