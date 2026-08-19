/**
 * Publish build.
 *
 * `exports` in package.json points at `dist`, because what goes to npm has to
 * be JS a plain Node resolver and a non-transpiling bundler can both read. This
 * script produces it. (The workspace apps do not wait on it — they alias
 * `blobatar/*` to `src` through tsconfig paths.)
 *
 * Each entry is bundled standalone, so `blob`, the barrel and the adapters each
 * carry a private copy of the renderer. `splitting: true` removes that
 * duplication and was tried; it is off deliberately, because the duplication is
 * on disk and the cost of removing it lands in consumer bundles.
 *
 * Measured by bundling consumers against the published `exports` map, gzipped:
 *
 *                        standalone   splitting
 *   import one entry        4202 B      4213 B   ← the common case, and it loses
 *   import two entries      5068 B      4310 B
 *   `dist` at rest        277755 B    153125 B
 *
 * Splitting is a 45% cut to `dist` and a 26% cut to the install, but it pays for
 * that with import statements in every entry, so the consumer who imports one
 * thing — nearly all of them — ships slightly more. Shipped bytes win over bytes
 * at rest, so the duplication stays.
 *
 * The other reason not to reach for it: on Bun 1.3.14 splitting compiles a
 * barrel whose body is *nothing but* re-exports into a module re-exporting names
 * it never imported, and Node throws `SyntaxError: Export 'C' is not defined in
 * module` on link. `src/index.ts` happens to avoid this because `VERSION` is a
 * real binding — verified by deleting it, building and linking under Node — so
 * turning splitting on silently couples this build to that one line.
 *
 * `scripts/smoke.mjs` is what caught that bug and links the built barrel under
 * Node on every build, so it will catch it again if anyone retries this.
 *
 * Note that `scripts/size.ts` cannot see any of the above — its synthetic
 * consumers import `../../src/*` and never touch `dist`, so its budgets did not
 * move by a single byte when splitting went on. It guards what the source
 * tree-shakes to, not what the package ships. Measure against `dist` if you
 * change the entry layout.
 */

import { rmSync } from "node:fs";
import { $ } from "bun";

const ENTRIES = [
  "src/index.ts",
  "src/blob.ts",
  "src/uri.ts",
  "src/expression.ts",
  "src/react.tsx",
  "src/vue.ts",
];

rmSync("dist", { recursive: true, force: true });

const build = await Bun.build({
  entrypoints: ENTRIES,
  outdir: "dist",
  target: "browser",
  format: "esm",
  minify: true,
  sourcemap: "linked",
  // Frameworks are peer dependencies and optional ones: never inline them,
  // and never let the JSX runtime import get rewritten into the bundle either.
  external: [
    "react", "react/jsx-runtime", "react/jsx-dev-runtime",
    "vue",
    "preact", "preact/compat",
    "solid-js",
  ],
  // What selects the JSX runtime. Bun reads `process.env.NODE_ENV` to choose
  // between `jsx` and `jsxDEV`, and a publish build run from a normal shell has
  // it unset — so without this the package shipped `react/jsx-dev-runtime`
  // calls. That resolves fine under Node, which is why `smoke.mjs` stayed green
  // on it, and dies in any consumer bundling for production, where that
  // specifier carries no `jsxDEV`: every animated blobatar throws
  // `jsxDEV is not a function` on first render.
  //
  // Stated here rather than as an env var on the script so that `bun run build`
  // yields the same package whatever the shell or CI has set. The failure is
  // invisible locally and only reaches a consumer, so it cannot be left to
  // ambient state.
  define: { "process.env.NODE_ENV": '"production"' },
});

if (!build.success) {
  for (const log of build.logs) console.error(log);
  process.exit(1);
}

// The stylesheet ships minified. `src/motion.css` is ~44 KB, nearly all of it
// the commentary explaining why each channel exists — worth reading in the
// repo, not worth shipping to a consumer who drops it in a <link> and gets no
// bundler pass over it.
const css = await Bun.build({
  entrypoints: ["src/motion.css"],
  outdir: "dist",
  minify: true,
});

if (!css.success) {
  for (const log of css.logs) console.error(log);
  process.exit(1);
}

// Types come from tsc, not from the bundler — Bun does not emit declarations.
await $`bunx tsc -p tsconfig.build.json`;

// Every map embeds a full copy of every source it covers, and the package ships
// `src` anyway for the declaration maps to point at. Five entries duplicating
// the same tree is 330 KB of a 380 KB tarball. The maps' `sources` are already
// relative paths into the shipped `src`, so dropping the inline copies costs
// nothing and a debugger still resolves them.
for (const out of build.outputs) {
  if (out.kind !== "sourcemap") continue;
  const map = await Bun.file(out.path).json();
  delete map.sourcesContent;
  await Bun.write(out.path, JSON.stringify(map));
}

for (const out of build.outputs) {
  if (out.kind !== "entry-point") continue;
  console.log(`✓ ${out.path.replace(process.cwd() + "/", "")}`);
}
