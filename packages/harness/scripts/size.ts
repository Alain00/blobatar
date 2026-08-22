/**
 * Bundle size gate for what the packages *ship*.
 *
 * `packages/blobatar/scripts/size.ts` is the other half of this and measures
 * something different on purpose: its synthetic consumers import `../../src/*`,
 * so it measures what the source tree-shakes to. That is the right instrument
 * for "did a palette tweak double the colour code", and the wrong one for "does
 * `bun add @blobatar/react` cost what we think", because nothing in it ever
 * touches a `dist` or resolves an `exports` map.
 *
 * This file is the second instrument. It lives here rather than in core for the
 * reason `packages/harness` exists at all: measuring `@blobatar/react` means
 * depending on `@blobatar/react`, and core cannot — the adapter peer-depends on
 * core, so a devDependency the other way makes turbo's `^build` graph cyclic.
 * Harness already declares every adapter and is never published.
 *
 * ## Why the consumer tree is built by hand
 *
 * A fixture written inside the workspace and importing `@blobatar/react` does
 * not measure `dist`. It measures core's *source*, silently:
 * `packages/react/tsconfig.json` aliases `blobatar/*` back to `../blobatar/src`
 * so a curve edit shows up without a build, and Bun applies the tsconfig
 * nearest the *importing* file — which, for `packages/react/dist/index.js`, is
 * that one. The alias is correct and must stay; it just cannot be in scope
 * here. Bun.build's `tsconfig` option does not override it (tried — the
 * per-file lookup wins), so the fixture is built in a tree that contains no
 * tsconfig at all: each package's `package.json` and `dist` copied under a
 * scratch `node_modules`, resolved by name through the real `exports` maps.
 *
 * Measured through the alias, `@blobatar/react` reported 5342 B rather than
 * 5228 — a number 114 B off, for core's source, from a fixture that looked
 * exactly like it was measuring the published package.
 *
 * Copied rather than `npm pack`ed, and that is a trade with a known edge.
 * A tarball would also prove the `files` field, but `npm pack` runs `prepack`,
 * which for core is `bun run build`, which starts by deleting `dist` — the
 * exact race `turbo.json` explains under `check`. A gate may not be the thing
 * that wipes a `dist` another task is reading. CI's `Pack` step covers `files`
 * on its own, after everything else has finished.
 */

import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "scripts/.consumer";
const MODULES = `${DIR}/node_modules`;

/** Every package the fixtures below resolve by name, and where it is built. */
const INSTALLED: { name: string; from: string }[] = [
  { name: "blobatar", from: "../blobatar" },
  { name: "@blobatar/react", from: "../react" },
  { name: "@blobatar/vue", from: "../vue" },
  { name: "@blobatar/solid", from: "../solid" },
  { name: "@blobatar/preact", from: "../preact" },
];

const ENTRIES: {
  name: string;
  budget: number;
  external: string[];
  source: string;
  /** Entry file extension. Defaults to a TSX consumer. */
  ext?: string;
}[] = [
  {
    // The row PR 3 exists for: the number a consumer pays for
    // `bun add @blobatar/react`, core included, only React external.
    //
    // Measured 5228 B gz against the 5204 of the subpath row below, so the
    // package indirection costs 24 B: one more module in the graph, its `const`
    // binding, and the re-export. That 24 B is not gated on its own — a delta
    // between two rows that both track the renderer was a weaker form of the
    // `alone` rows below, which bound the same file directly and 60x tighter.
    //
    // Expect it to track core's `react` row rather than lead it: this is the
    // same component reached by a different specifier. A change that moves one
    // and not the other is a packaging change, and there is exactly one of
    // those in flight — the v3 swap, where the implementation moves into the
    // package and `blobatar/react` is deleted. On that day the subpath rows go
    // away and these are what is left.
    // Raised from 5260 by ~242 B for travel + depth (see
    // docs/3d-directional-motion-plan.md §7): `travelVars`, the depth ellipses
    // and wrapper group in the animated branch, and the prop on both union
    // arms. The same delta core's `react` row absorbed, measured through dist.
    name: "@blobatar/react",
    budget: 5520,
    external: ["react"],
    source: `import { Blobatar } from "@blobatar/react";
             globalThis.x = Blobatar;`,
  },
  {
    // The deprecated subpath, measured through `dist` rather than through
    // source. Core's own `react` row measures the same component at 5336 from
    // `src`, and the 132 B between them is not a regression in either
    // direction — it is core's publish build minifying better than a synthetic
    // consumer of its source does. Two numbers for one component is the price
    // of having two instruments, and the reason each file's header says which
    // one it is.
    //
    // This row is here so the pair delta below has something to subtract, and
    // it retires with the subpath in v3.
    name: "blobatar/react",
    budget: 5520,
    external: ["react"],
    source: `import { Blobatar } from "blobatar/react";
             globalThis.x = Blobatar;`,
  },
  {
    // ~176 B over React, and it is the same ~170 B core's `vue` row already
    // accounts for: the runtime props table, the string-style merge, and the
    // `default: undefined` on every prop. Vue surface, not packaging — its
    // indirection over the subpath row is 27 B against React's 24.
    name: "@blobatar/vue",
    budget: 5720,
    external: ["vue"],
    ext: "ts",
    source: `import { Blobatar } from "@blobatar/vue";
             globalThis.x = Blobatar;`,
  },
  {
    name: "blobatar/vue",
    budget: 5720,
    external: ["vue"],
    ext: "ts",
    source: `import { Blobatar } from "blobatar/vue";
             globalThis.x = Blobatar;`,
  },
  {
    // The first two rows for an adapter that holds a component rather than
    // re-exporting one, so this is core plus real adapter code — not core plus
    // an indirection. Expect it to sit above the React row by whatever the
    // component costs, and see the `alone` row below for that number on its own.
    // 6432 B measured. ~1.2 kB over the React row, which is the component
    // itself: Solid's compiled output carries its own `template`/`insert`
    // scaffolding per element, where React's row is a re-export standing in
    // front of core's already-minified `dist/react.js`.
    name: "@blobatar/solid",
    budget: 6720,
    external: ["solid-js", "solid-js/web"],
    ext: "tsx",
    source: `import { Blobatar } from "@blobatar/solid";
             globalThis.x = Blobatar;`,
  },
  {
    // 6011 B measured, ~780 B over React's row and ~420 B under Solid's — the
    // same component written against a runtime that needs less per element.
    name: "@blobatar/preact",
    budget: 6320,
    external: ["preact", "preact/hooks", "preact/jsx-runtime"],
    ext: "tsx",
    source: `import { Blobatar } from "@blobatar/preact";
             globalThis.x = Blobatar;`,
  },

  // The two rows below are the only place the externals in each adapter's
  // `scripts/build.ts` are falsifiable, and finding that out cost a wrong
  // comment in the first draft of this file.
  //
  // The intuition is that inlining core into an adapter would show up as a
  // consumer paying for the renderer twice. It does not. A consumer of one
  // adapter has one copy either way — the bundler dedupes what the adapter
  // inlined against nothing else. And a consumer of *both* adapters already
  // pays twice with the externals working, because core's publish build emits
  // standalone entries: `dist/react.js` and `dist/vue.js` each carry their own
  // renderer, which is the trade stated in `packages/blobatar/scripts/build.ts`
  // and inherited here by re-export. So no whole-consumer number moves.
  // Deleting the external list entirely and rebuilding moved the row above by
  // -11 B, in the wrong direction, and every gate stayed green.
  //
  // What does move is the adapter's own `dist`. Bundled with core external, it
  // is the two-line re-export it is supposed to be. With the externals broken
  // it was 5217 B — the whole renderer, sitting inside a package that declares
  // core a peer dependency. That is the shape this catches, and it is worth
  // catching for a reason bigger than bytes: a package that both peer-depends
  // on core and carries a private copy renders one generation while resolving
  // another (ADR-0008), which is the mixed install `packages/harness`'s
  // packaging test exists to forbid.
  {
    // 78 B measured. The budget is loose in ratio and tight in absolute, which
    // suits a row whose failure mode is two orders of magnitude away — there is
    // no correct change that puts 30 B into a re-export, and none that puts
    // 5 kB there either without being exactly the bug described above.
    name: "@blobatar/react alone",
    budget: 110,
    external: ["react", "blobatar", "blobatar/react", "blobatar/internal", "blobatar/uri"],
    source: `import { Blobatar } from "@blobatar/react";
             globalThis.x = Blobatar;`,
  },
  {
    name: "@blobatar/vue alone",
    budget: 110,
    external: ["vue", "blobatar", "blobatar/vue", "blobatar/internal", "blobatar/uri"],
    ext: "ts",
    source: `import { Blobatar } from "@blobatar/vue";
             globalThis.x = Blobatar;`,
  },
  // The two rows below are the same instrument pointed at a different shape.
  // React's and Vue's `alone` rows measure a re-export and are budgeted at
  // 110 B because there is no correct change that puts more there. These two
  // hold an actual component, so the number is real code and the budget has to
  // be. What it still catches is the same thing: core turning up inside a
  // package that peer-depends on core would move this row by two orders of
  // magnitude, not by tens of bytes.
  {
    // 996 B measured.
    name: "@blobatar/solid alone",
    budget: 1030,
    external: ["solid-js", "solid-js/web", "blobatar", "blobatar/internal", "blobatar/uri"],
    ext: "tsx",
    source: `import { Blobatar } from "@blobatar/solid";
             globalThis.x = Blobatar;`,
  },
  {
    // 570 B measured.
    name: "@blobatar/preact alone",
    budget: 600,
    external: ["preact", "preact/hooks", "preact/jsx-runtime", "blobatar", "blobatar/internal", "blobatar/uri"],
    ext: "tsx",
    source: `import { Blobatar } from "@blobatar/preact";
             globalThis.x = Blobatar;`,
  },
];

/**
 * The source-resolved adapters, measured as what they publish.
 *
 * `@blobatar/svelte` has no `dist` for a fixture to import, so the row above
 * cannot exist for it — and the first draft of this file answered that by
 * skipping it, with a `budget: 0` and a `skip: true`. That is the wrong answer
 * twice over. It leaves the one package whose published artifact is source
 * unmeasured, and it quietly changes what the ship gate means: `CONTEXT.md`
 * defines it as "what does `bun add @blobatar/react` cost", not "what does it
 * cost when it happens to have a dist".
 *
 * A source-resolved package has a perfectly good number — the bytes it ships,
 * gzipped. It is not comparable to a bundled row and is not meant to be: it
 * answers what crosses the wire, and the compiler on the far side is the
 * consumer's, so what it compiles *to* is not this package's to report.
 */
const SHIPPED: { name: string; from: string; budget: number }[] = [
  // 2613 B measured, and larger than any bundled row above for a reason worth
  // stating rather than optimizing away: this is source, so it ships its
  // comments. The consumer's compiler drops them before they reach a bundle, so
  // the number a *user* pays is smaller than this one and is not measurable
  // here — what this row gates is the wire, which is the only part this package
  // controls.
  { name: "@blobatar/svelte", from: "../svelte/src", budget: 2650 },
];

rmSync(DIR, { recursive: true, force: true });
for (const pkg of INSTALLED) {
  const dest = `${MODULES}/${pkg.name}`;
  mkdirSync(dest, { recursive: true });
  cpSync(`${pkg.from}/package.json`, `${dest}/package.json`);
  // The stale tree was removed above, so a missing `dist` throws here rather
  // than leaving the run to measure whatever was left over from last time.
  cpSync(`${pkg.from}/dist`, `${dest}/dist`, { recursive: true });
}

let failed = false;

for (const entry of ENTRIES) {
  const file = `${DIR}/${entry.name.replace(/\W+/g, "-")}.${entry.ext ?? "tsx"}`;
  writeFileSync(file, entry.source);

  const build = await Bun.build({
    entrypoints: [file],
    target: "browser",
    minify: true,
    external: entry.external,
  });

  if (!build.success) {
    console.error(`✗ ${entry.name} failed to build`);
    for (const log of build.logs) console.error(log);
    failed = true;
    continue;
  }

  const raw = await build.outputs[0]!.arrayBuffer();
  const gz = Bun.gzipSync(new Uint8Array(raw)).byteLength;
  const ok = gz <= entry.budget;
  failed ||= !ok;

  console.log(
    `${ok ? "✓" : "✗"} ${entry.name.padEnd(21)} ${String(gz).padStart(5)} B gz` +
      ` / ${String(entry.budget).padStart(5)} B  (${Math.round((gz / entry.budget) * 100)}%)`,
  );
}

for (const pkg of SHIPPED) {
  // `.d.ts` excluded: declarations are erased before anything runs, and a type
  // is not a byte a consumer's bundle carries.
  const bytes = readdirSync(pkg.from)
    .filter((f) => !f.endsWith(".d.ts"))
    .map((f) => readFileSync(join(pkg.from, f)));

  const gz = Bun.gzipSync(Buffer.concat(bytes)).byteLength;
  const ok = gz <= pkg.budget;
  failed ||= !ok;

  console.log(
    `${ok ? "✓" : "✗"} ${`${pkg.name} shipped`.padEnd(21)} ${String(gz).padStart(5)} B gz` +
      ` / ${String(pkg.budget).padStart(5)} B  (${Math.round((gz / pkg.budget) * 100)}%)`,
  );
}

rmSync(DIR, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
