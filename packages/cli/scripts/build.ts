/**
 * Builds the published bin: one plain-JS ESM file with the private
 * `render-core` inlined (it is never published, so it cannot stay an import)
 * and the three real runtime dependencies — `blobatar`, its frozen-v1 alias
 * `blobatar-v1`, and `@resvg/resvg-js` — left external, to be resolved from
 * the consumer's node_modules.
 */
import { chmod } from "node:fs/promises";

const result = await Bun.build({
  entrypoints: ["src/main.ts"],
  outdir: "dist",
  target: "node",
  format: "esm",
  naming: "blobatar.mjs",
  external: ["blobatar", "blobatar/*", "blobatar-v1", "blobatar-v1/*", "@resvg/resvg-js"],
  banner: "#!/usr/bin/env node",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await chmod("dist/blobatar.mjs", 0o755);
const built = result.outputs[0];
console.log(`✓ dist/blobatar.mjs (${built ? built.size : "?"} bytes)`);
