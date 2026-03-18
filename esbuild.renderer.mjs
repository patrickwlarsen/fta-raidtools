import * as esbuild from "esbuild";

const config = {
  entryPoints: ["src/renderer/index.ts"],
  bundle: true,
  outfile: "renderer.js",
  platform: "browser",
  target: "chrome128",
  format: "iife",
};

if (process.argv.includes("--watch")) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log("esbuild watching for changes...");
} else {
  await esbuild.build(config);
}
