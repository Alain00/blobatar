/**
 * Bundle size gate.
 *
 * Measured through synthetic consumers rather than by building the barrel
 * directly — a library entry with no importer tree-shakes to nothing, which
 * reports a flattering number that no real app ever sees.
 *
 * Budgets are per entry point. The core budget is the one that matters: it is
 * what stops a convenience import from quietly pulling in the React adapter, or
 * a palette tweak from doubling the color code.
 *
 * This is the **source gate**, and the name is load-bearing. Every consumer
 * below imports `../../src/*` and none of them ever touches `dist` or resolves
 * an `exports` map, so what is measured here is what the source tree-shakes to —
 * not what the published package costs. The two are not the same number: core's
 * publish build minifies better than a synthetic consumer of its source does,
 * and `react` below reads 5336 against 5204 for the same component reached
 * through `dist`.
 *
 * What ships is the **ship gate**, `packages/harness/scripts/size.ts`, which
 * resolves each package by name. It lives there rather than here because
 * measuring `@blobatar/react` means depending on it, and core cannot — the
 * adapter peer-depends on core, so the devDependency back would make turbo's
 * `^build` graph cyclic.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const DIR = "scripts/.fixtures";

const ENTRIES: {
  name: string;
  budget: number;
  external: string[];
  source: string;
  /** Entry file extension. Defaults to a TSX consumer. */
  ext?: string;
}[] = [
  {
    // Expressions are passed in as values from `blobatar/expression`, so a
    // consumer who never imports one carries no pose code at all — see the
    // "blob + happy" entry below for what one costs. Held tight deliberately:
    // this is the number that catches the option creeping back into the core.
    //
    // Raised again by 30 B — 19 of them spent — when each animated eye started
    // emitting its own `transform-origin`. That is not a feature, it is the
    // price of a Gecko bug: a `<g>`'s `fill-box` follows its children, so a
    // blink moved the eye wrapper's origin and a posed eye travelled ~30 viewBox
    // units every time it blinked. Pinning the origin in the markup is the only
    // place the fix can live, since the value is per eye. Every entry below
    // carries the same 19 B for the same reason. See `.mo-eye` in `motion.css`.
    //
    // Raised from 3700 by 33 B when expressions gained a colour channel. That is
    // the whole of what the core pays for it: one call through `tint` on the
    // expression value, on the static path, next to the `bake` call that was
    // already there. Everything that computes a colour — `hot`, `mixHex`,
    // `fromHex` — is reached only from an expression that tints, and this row
    // proves it is shaken out, because a consumer who imports none still lands
    // here rather than 200 B higher.
    //
    // Raised from 3780 by 20 B for trait overrides, and the number is the whole
    // argument for that design: making *every* axis of the blobatar configurable
    // cost one lookup and an inline clamp on the trait reader, because the
    // layout already addressed its values by key. A prop per knob would have
    // put ~25 named options and their plumbing in this row instead. Measured at
    // 1 B over before the budget bump — the branch gzips against the reader
    // that was already there.
    // Lowered from 3800 when the `character` variant was removed in 0.1.0. The
    // variant itself was never in this row — what came out was the plumbing that
    // existed only to keep two of them apart: the palette's variant-keyed ramp
    // and floor tables, the `expressive` flag, and the `variant` argument
    // threaded through `resolve`.
    // Blobatar 2 binds its ten-shape style directly. The private composer keeps
    // silhouette implementations local without retaining a runtime generation
    // branch or any historical mapping in this graph (ADR-0008).
    // Measured against published v0.2.0's six-shape renderer: 3657 → 4247 B
    // gzip, +590 B (+16.1%). The abandoned runtime-generation version measured
    // 4286 B, so making the package major the seam recovers 39 B as well as the
    // public API complexity.
    // Raised from 4300 by 110 B when the capsule and droplet stopped being
    // approximated. Both drew a union whose parts crossed rather than met — a
    // rounded box behind two cap circles, a soft diamond stabbed into a ball —
    // and both showed the crease. `box` and `taper` in `shape.ts` are what the
    // exactness costs: a stadium needs a run at full height for its caps to meet
    // along their diameters, and a taper has to be the tangents from its apex to
    // the body ellipse. Measured against the arc-drawn single-outline version of
    // the same two shapes, which is a further 108 B for an identical render.
    //
    // Raised from 4410 by 70 B for `backgroundColor`: the option wiring and
    // measuring the plate, so the body/backdrop floor holds against a caller's
    // color rather than only against the authored one. That is the sRGB decode
    // and a cube root — `fromHex` would have cost roughly twice as much again,
    // since nothing else in the core reaches the OKLab decode. Every entry
    // below that renders carries the same bytes for the same reason.
    //
    // Raised from 4480 by 50 B for `defs` and `paint`: the `<defs>` wrapper around a
    // caller's markup, and the body's paint swapped in after the tint, each written
    // once and used by both `makeBlobatar` and `makeParts`, plus `--mo-head` taking
    // the paint ahead of the tinted color. Every entry below that renders carries
    // the same bytes for the same reason.
    name: "blob only",
    budget: 4530,
    external: [] as string[],
    source: `import { blobatar } from "../../src/blob";
             globalThis.x = blobatar(String(globalThis.seed));`,
  },
  {
    // The barrel. Costs more than `blob only` above because it also carries the
    // colour and trait utilities, which a consumer who only renders never touches.
    name: "barrel",
    budget: 4520,
    external: [],
    source: `import { blobatar } from "../../src/index";
             globalThis.x = blobatar(String(globalThis.seed));`,
  },
  {
    name: "uri",
    budget: 4620,
    external: [],
    source: `import { blobatarUri } from "../../src/uri";
             globalThis.x = blobatarUri(String(globalThis.seed));`,
  },
  {
    // Carries both rendering modes: the <img> path and the inline-SVG path that
    // `animate` needs. The inline path is ~570 B of that — the motion traits,
    // the parts builder, and the second branch of the component.
    //
    // Raised from 5650 by 80 B when the animated branch stopped being a single
    // `dangerouslySetInnerHTML` and became three children: a `<title>`, the
    // backdrop as a real `<path>`, and the root `<g>` whose class React now
    // owns. That last one is the point — the root class varies with the
    // expression, and a varying class inside an innerHTML string replaces the
    // subtree on every change, which costs the morph and restarts every idle
    // animation under it. 80 B is the price of the transition existing.
    //
    // Raised again from 5750 by 64 B for the colour channel: the 33 B the core
    // pays (see "blob only") plus the animated path emitting the resolved fills
    // as `--mo-head`/`--mo-eye`. Those go out on every animated `blob`, tinted
    // or not, so the stylesheet's `fill` rules always resolve to something
    // correct — a `var()` with nothing behind it makes `fill` inherit black.
    //
    // Raised from 5370 by 120 B for `backgroundColor` — see "blob only".
    //
    // Raised from 5490 by 65 B for `defs` and `paint` — see "blob only" — plus the
    // two props named in the component's destructure and in the options it builds.
    name: "react",
    budget: 5555,
    external: ["react"],
    source: `import { Blobatar } from "../../src/react";
             globalThis.x = Blobatar;`,
  },
  {
    // The point of `blobatar/expression` being its own entry: importing one
    // expression must not drag the other three in. Measured against "blob only"
    // above — the delta is what a single pose actually costs.
    // Measured: +343 B for the first expression (the shared serializer and bake,
    // paid once) and +36 B for each one after it. Importing all three is 4098.
    name: "blob + happy",
    budget: 4860,
    external: [],
    source: `import { blobatar } from "../../src/blob";
             import { happy } from "../../src/expression";
             globalThis.x = blobatar(String(globalThis.seed), { expression: happy });`,
  },
  {
    // The Vue adapter, measured against "react" above. Same two rendering
    // modes and the same parts builder; the Vue one swaps the JSX branch for
    // `h()` calls and Vue's fine-grained reactivity for the React memo tricks
    // (no serialized dependency string, no memoized `{__html}`).
    //
    // It still lands ~170 B over React: the runtime props table (12 declared
    // props — React's are type-level only), the string-style merge for
    // templates that pass `style="…"`, and the `default: undefined` on every
    // prop that keeps Vue from inventing values the caller never passed. All
    // three are Vue surface, not motion; none of them would shrink if the
    // animation layer got smaller. `vue` is external, like `react`.
    // Measured 5506 against react 5336 on the v2 core.
    //
    // The only budget here carrying real slack rather than the ~35 B tripwire
    // the others use. The adapter is the newest surface and the one most
    // likely to need a correction, and a gate that fails on a 20 B bug fix
    // teaches people to raise the number without reading it.
    //
    // Raised from 5650 by 70 B for `backgroundColor` — see "blob only" — plus
    // the runtime prop declaration, keeping the slack described above.
    //
    // Raised from 5720 by 75 B for `defs` and `paint` — see "blob only" — plus the
    // two runtime prop declarations and their lines in the options object.
    name: "vue",
    budget: 5795,
    external: ["vue"],
    source: `import { Blobatar } from "../../src/vue";
             globalThis.x = Blobatar;`,
  },
  {
    name: "traits only",
    budget: 600,
    external: [],
    source: `import { traits } from "../../src/traits";
             globalThis.x = traits(String(globalThis.seed))("hue");`,
  },
  {
    // Bundled rather than gzipped straight off disk, so a syntax error here
    // fails the gate instead of shipping. Paid once per app, not per blobatar,
    // which is the whole reason the keyframes are not inlined into each SVG.
    name: "motion css",
    // Raised again from 950 for the expression layer: nine `@property`
    // registrations, the pose terms folded into the existing keyframes, and the
    // reduced-motion block restating the pose statically (an expression must
    // survive reduced motion — only the morph is removed). The registrations
    // look like the expensive part and are not; nine near-identical blocks
    // gzip to almost nothing, which is the same effect the wrap chains rely on.
    //
    // Previously raised from 800 for the wrap layer (§4.7), which no smaller form fits:
    // foreshortening alone measured 854, and the two obvious factorings both
    // came out *larger* than writing the chains out (see `@keyframes mo-wrap`).
    // Worth it here and nowhere else — this file is paid once per app, so 180
    // bytes buys the same 3D read that per-blobatar markup could not afford.
    // Raised from 1200 for two corrections rather than features: the shared
    // `transform-box`/`transform-origin` rule that puts the body layers'
    // pivot back at the middle of the frame instead of SVG's default corner,
    // and the lean brackets around every eye scale, which stop a leaned capsule
    // squashing along screen axes. Both are what `scripts/probe-compose.ts`
    // measures; neither is optional.
    //
    // Raised from 1250 for the exaggeration pass, which is a net add of ~130 B
    // after the body-scale and lean channels came out. Three things bought it,
    // and all three are things markup would otherwise have to carry per blobatar:
    //
    //  - Per-eye asymmetry. Three registrations and four derived values on
    //    `.mo-eye`, replacing the only other option — per-eye inline styles,
    //    which are forbidden because nothing in `parts.inner` may vary with the
    //    expression.
    //  - The tremor: one registration and a four-stop keyframe.
    //  - The two `fill` rules, which is how a hot pose reaches a colour that
    //    lives in a presentation attribute CSS cannot read.
    //
    // The transition lists got *shorter* despite three more channels, because
    // the duration and easing lists are now stated once in `--mo-md`/`--mo-me`
    // instead of being restated in full by the `:hover` rule.
    // Raised from 1400 for one rule, and it is the cheapest 7 bytes in the
    // file: pausing the idle loops on touch devices, where the hover rule two
    // lines above it has already pinned `--mo-amp` at zero and the loops can
    // therefore only resolve to the identity pose. Measured on a page with
    // sixty blobatars, it took style and layout in a Lighthouse trace from
    // 6.7s to 1.9s — the loops are ~8 per blobatar and most of them drive
    // registered custom properties, which recalculate on the main thread
    // rather than compositing. A grid that reads as a crowd is the case this
    // library invites, so that is the case worth being cheap in.
    // Raised from 1450 for `thinking`, and this is the raise worth arguing
    // with. Every other entry in this list is paid by the consumer who asked for
    // the feature; this file is paid by everyone who imports the stylesheet, so
    // 95 B here is 95 B on an app that will never render a loading face. It buys
    // the only thing the pose vocabulary could not previously say — a message
    // that is a *duration* rather than a shape — and it buys it for every future
    // pose that wants one, since `--mo-rock` is an amplitude and not a switch.
    // Three parts, in descending order of cost:
    //
    //  - The seesaw itself: two registrations, a two-stop keyframe and the
    //    `--mo-ph` blend on `.mo-eye` that makes a symmetric swing and a
    //    one-sided differential the same term. The blend is what removes the
    //    corrective arithmetic from `bakePose`, so it is cheaper than it looks.
    //  - `--mo-edy2`: one registration and one term in an existing `translate`.
    //  - The touch-device exception, ~55 B, which is the price of the loop not
    //    being gated on `--mo-amp` like everything else in the file. Without it
    //    the feature is frozen on every phone.
    budget: 1550,
    external: [],
    ext: "css",
    source: `@import "../../src/motion.css";`,
  },
  {
    // The one motion layer with a JavaScript half, and the only one a consumer
    // can decline: §4.5 ships as its own entry precisely so that a page with no
    // pointer driver never pays for it. Measured through the driver rather than
    // through `step`, because the driver is what a page imports and the pure
    // core comes with it.
    //
    // `docs/motion-spec.md` §10 reserved 900 B for this before it was written,
    // and it does not fit: measured at 1194. Raised rather than shaved, because
    // the three things over that estimate are the three the estimate predated,
    // and each is load-bearing.
    //
    //  - The live media queries. `prefers-reduced-motion` and `hover: hover`
    //    are read as `MediaQueryList`s with `change` listeners, not sampled once
    //    at construction, so the driver attaches and detaches as they move. A
    //    person turning reduced motion on mid-session is asking for the motion
    //    to stop now, not on their next reload, and a driver that samples cannot
    //    honour that. The attach/detach pair is most of this entry's overage.
    //  - `--mo-track-hold`, its own exponential and its own coarser threshold,
    //    which is what lets the idle rove cross-fade out instead of being
    //    hard-zeroed by every host that wants both layers.
    //  - Reading `--mo-track-travel` back off the element, so the excursion has
    //    one home in the stylesheet rather than two that drift.
    //
    // The floor to hold it against is `motion.css`: this is the layer a page
    // without a pointer driver declines entirely, which is the whole reason it
    // is a separate entry and not more bytes on the file everybody pays for.
    //
    // Raised from 1250 for the spherical projection (§4.5's wrap). That is
    // `project()`, the per-eye survey `getBBox` gives it, and five writes an
    // eye per moving frame instead of two for the pair. What it buys is the
    // thing the translate it replaced could not do at any budget: an eye that
    // cannot leave the head, because a sine does not exceed one. The
    // alternative was a `clipPath` per blobatar, which costs an id, and "emits
    // no ids" is a guarantee with a test behind it.
    // …and to 2100 for fitting the head to the silhouette rather than to its
    // bounding box. The roster does not agree on one number — the largest safe
    // ellipse is 0.98 of the box on `round` and 0.39 on `triangle` — so it is
    // measured per blobatar with sixteen bisections against `isPointInFill`,
    // once on attach, in viewBox units that a scroll cannot change.
    // …and to 2400 for the target vocabulary: `lookAt` takes an element, the
    // two words, or a point, where it used to take a point or `null`. The bytes
    // are the element being watched rather than sampled — its centre re-read on
    // the measure the driver already does, and a second `observe` on the one
    // `ResizeObserver` it already has — plus the stand-down becoming a ramp
    // toward a target instead of toward 1, which is what makes `lookAt(null)`
    // hand the idle glance back over a curve rather than switch it on. Both
    // were previously the caller's problem, and the element one cost every
    // caller two scroll listeners to solve worse.
    name: "gaze",
    budget: 2400,
    external: [],
    source: `import { gaze } from "../../src/gaze";
             globalThis.x = gaze(globalThis.el as SVGSVGElement);`,
  },
  {
    // Separate from `motion css` for the reason the stylesheet's own header
    // gives: this file is paid only by pages that drive a gaze, and folding it
    // into the one everybody pays for would mean raising that budget to carry
    // rules most consumers never use.
    // Raised from 300 with the projection: three of `motion.css`'s own
    // declarations restated with the gaze's terms folded in, because `.mo-eye`
    // has no free transform property left, plus the five per-eye mixes that
    // pick a side through `--mo-sel`.
    name: "gaze css",
    budget: 450,
    external: [],
    ext: "css",
    source: `@import "../../src/gaze.css";`,
  },
];

rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });

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
    `${ok ? "✓" : "✗"} ${entry.name.padEnd(13)} ${String(gz).padStart(5)} B gz` +
      ` / ${String(entry.budget).padStart(5)} B  (${Math.round((gz / entry.budget) * 100)}%)`,
  );
}

rmSync(DIR, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
