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
  { name: "@blobatar/react-native", from: "../react-native" },
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
  // +60 B gz on every row that animates, and it is one cause across all of
  // them: the seeded timings a blobatar's loops run on are now derived once, by
  // `motionSeeds`, and `motionVars` serializes that rather than computing its
  // own. React Native has no stylesheet to read custom properties out of, so it
  // needs the numbers; the web needs the strings; and two derivations of them
  // would be two crowds drifting apart, which is the one property in the whole
  // motion layer that a grid actually shows. The cost is a named object with
  // ten keys that minification cannot mangle.
    // Raised for `backgroundColor` (the core cost, plus a little where the adapter
    // forwards the prop) — see "blob only" in core's `scripts/size.ts`.
    // Raised from 5480 by 65 B for `defs` and `paint` (the core cost, plus the props forwarded
    // where the adapter takes them) — see "blob only" in core's `scripts/size.ts`.
    name: "@blobatar/react",
    budget: 5545,
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
  // +60 B gz on every row that animates, and it is one cause across all of
  // them: the seeded timings a blobatar's loops run on are now derived once, by
  // `motionSeeds`, and `motionVars` serializes that rather than computing its
  // own. React Native has no stylesheet to read custom properties out of, so it
  // needs the numbers; the web needs the strings; and two derivations of them
  // would be two crowds drifting apart, which is the one property in the whole
  // motion layer that a grid actually shows. The cost is a named object with
  // ten keys that minification cannot mangle.
    // Raised for `backgroundColor` (the core cost, plus a little where the adapter
    // forwards the prop) — see "blob only" in core's `scripts/size.ts`.
    // Raised from 5480 by 65 B for `defs` and `paint` (the core cost, plus the props forwarded
    // where the adapter takes them) — see "blob only" in core's `scripts/size.ts`.
    name: "blobatar/react",
    budget: 5545,
    external: ["react"],
    source: `import { Blobatar } from "blobatar/react";
             globalThis.x = Blobatar;`,
  },
  {
    // ~176 B over React, and it is the same ~170 B core's `vue` row already
    // accounts for: the runtime props table, the string-style merge, and the
    // `default: undefined` on every prop. Vue surface, not packaging — its
    // indirection over the subpath row is 27 B against React's 24.
  // +60 B gz on every row that animates, and it is one cause across all of
  // them: the seeded timings a blobatar's loops run on are now derived once, by
  // `motionSeeds`, and `motionVars` serializes that rather than computing its
  // own. React Native has no stylesheet to read custom properties out of, so it
  // needs the numbers; the web needs the strings; and two derivations of them
  // would be two crowds drifting apart, which is the one property in the whole
  // motion layer that a grid actually shows. The cost is a named object with
  // ten keys that minification cannot mangle.
    // Raised for `backgroundColor` (the core cost, plus a little where the adapter
    // forwards the prop) — see "blob only" in core's `scripts/size.ts`.
    // Raised from 5680 by 75 B for `defs` and `paint` (the core cost, plus the props forwarded
    // where the adapter takes them) — see "blob only" in core's `scripts/size.ts`.
    name: "@blobatar/vue",
    budget: 5755,
    external: ["vue"],
    ext: "ts",
    source: `import { Blobatar } from "@blobatar/vue";
             globalThis.x = Blobatar;`,
  },
  {
  // +60 B gz on every row that animates, and it is one cause across all of
  // them: the seeded timings a blobatar's loops run on are now derived once, by
  // `motionSeeds`, and `motionVars` serializes that rather than computing its
  // own. React Native has no stylesheet to read custom properties out of, so it
  // needs the numbers; the web needs the strings; and two derivations of them
  // would be two crowds drifting apart, which is the one property in the whole
  // motion layer that a grid actually shows. The cost is a named object with
  // ten keys that minification cannot mangle.
    // Raised for `backgroundColor` (the core cost, plus a little where the adapter
    // forwards the prop) — see "blob only" in core's `scripts/size.ts`.
    // Raised from 5670 by 80 B for `defs` and `paint` (the core cost, plus the props forwarded
    // where the adapter takes them) — see "blob only" in core's `scripts/size.ts`.
    name: "blobatar/vue",
    budget: 5750,
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
    // 6451 B measured. ~1.2 kB over the React row, which is the component
    // itself: Solid's compiled output carries its own `template`/`insert`
    // scaffolding per element, where React's row is a re-export standing in
    // front of core's already-minified `dist/react.js`.
    // Raised from 6470 by `<Show>` replacing the branch's ternary — 19 B for an
    // `<svg>` that survives a prop change instead of being rebuilt on every
    // one. `@blobatar/solid alone` carries the same 17 B.
    // Raised for `backgroundColor` (the core cost, plus a little where the adapter
    // forwards the prop) — see "blob only" in core's `scripts/size.ts`.
    // Raised from 6700 by 85 B for `defs` and `paint` (the core cost, plus the props forwarded
    // where the adapter takes them) — see "blob only" in core's `scripts/size.ts`.
    name: "@blobatar/solid",
    budget: 6785,
    external: ["solid-js", "solid-js/web"],
    ext: "tsx",
    source: `import { Blobatar } from "@blobatar/solid";
             globalThis.x = Blobatar;`,
  },
  {
    // 6057 B measured, ~780 B over React's row and ~420 B under Solid's — the
    // same component written against a runtime that needs less per element.
    // Raised from 6050 by `elementRef`, which is 15 B of forwarding on the
    // adapter's own row and the only way `@blobatar/preact/gaze` can be handed
    // an element: Preact takes `ref` off a function component's props before
    // the component sees them.
    // Raised for `backgroundColor` (the core cost, plus a little where the adapter
    // forwards the prop) — see "blob only" in core's `scripts/size.ts`.
    // Raised from 6300 by 75 B for `defs` and `paint` (the core cost, plus the props forwarded
    // where the adapter takes them) — see "blob only" in core's `scripts/size.ts`.
    name: "@blobatar/preact",
    budget: 6375,
    external: ["preact", "preact/hooks", "preact/jsx-runtime"],
    ext: "tsx",
    source: `import { Blobatar } from "@blobatar/preact";
             globalThis.x = Blobatar;`,
  },

  {
    // 4804 B measured, and the row is *smaller* than every other adapter's.
    // That looks wrong and is not, so the reason is here rather than left for
    // somebody to rediscover as a suspected mismeasurement.
    //
    // The DOM adapters reach core through `blobatar/react`, which carries the
    // whole two-mode component: `blobatarUri` for the static `<img>`, `_parts`
    // and the motion vars for the animated inline SVG. This one reaches core
    // through `blobatar/internal` and touches `_marks` alone. There is no URI
    // encoder in it because there is no `<img>`, and no motion layer because
    // there is no CSS, so the paths that make those adapters bigger are paths
    // this consumer never links.
    //
    // What the row does *not* include, unavoidably: `react-native-svg` is
    // external, as it must be. It is a native module with a build step on the
    // far side of the bridge, so a bundled copy would be a second JavaScript
    // half talking to native code that was never linked for it. Its bytes are
    // not this package's to report. What is gated here is the JavaScript
    // blobatar itself ships.
    // 4907 B now, against the 4804 the row measured before the morph existed.
    // The 103 B is the price of splitting the component in two: the outer
    // `<Svg>` and the option-splitting are shared functions rather than one
    // inlined body, so the still path pays an indirection it used to inline.
    // It buys ~1.1 kB, see the morph row below, and the alternative was two
    // copies of the accessibility mapping, which is the part of this adapter
    // most likely to be corrected once and left wrong in the other copy.
    //
    // This row's job is now also to say the still path stayed still. A change
    // that moves it and the morph row together is core; a change that moves
    // only the morph row is the morph; a change that moves only this one means
    // something the morph needs became reachable from the component that does
    // not.
    // Raised for `backgroundColor` (the core cost, plus a little where the adapter
    // forwards the prop) — see "blob only" in core's `scripts/size.ts`.
    // Raised from 5190 by 50 B for `defs` and `paint`: the core cost alone. This adapter does
    // not take them (no markup to put them in) — see "blob only" in core's `scripts/size.ts`.
    name: "@blobatar/react-native",
    budget: 5240,
    external: ["react", "react/jsx-runtime", "react-native", "react-native-svg"],
    ext: "tsx",
    source: `import { Blobatar } from "@blobatar/react-native";
             globalThis.x = Blobatar;`,
  },
  {
    // The third tier, and the largest: the idle layer on top of the morph.
    // Seven loops evaluated per frame, the seeded timings they run on, and one
    // more level of grouping per eye.
    //
    // Its job here is the same as the other two rows': to say that the tiers
    // stay separate. A change that moves this row and not the two above it is
    // the idle layer; a change that moves all three is core; a change that
    // moves a smaller row is a tier leaking into the one below, which is the
    // failure the whole three-component shape exists to prevent and which the
    // keyframe tables caused twice before landing on their own entry point.
    // 10144 B, against 7360 for the same component on a `requestAnimationFrame`
    // driver. The ~2.8 kB is Reanimated's, and it is not overhead that can be
    // optimised away: the worklets plugin embeds each worklet's *source* as a
    // string, because that is how a function reaches the UI runtime. Twenty-one
    // worklets means twenty-one copies of their own text.
    //
    // Up from 9880 when the loops started composing a matrix instead of
    // printing a `transform` string, which is the only spelling that survives a
    // prop written from the UI thread. `packages/react-native/src/worklets.ts`
    // has the account. The arithmetic is the same arithmetic; what costs the
    // 264 B is that every character of it is paid for twice, once as code and
    // once as the source string beside it. That is also why the glance is
    // multiplied out by hand rather than composed through matrix helpers: a
    // helper two worklets call is serialized into both of them, so the pair
    // that read better cost more than the algebra they hid.
    //
    // Bought deliberately. The loops run off the JS thread, which is the only
    // way a sidebar of agents animating at once stays smooth, and that is what
    // this component is for. A consumer who does not want the bytes or the
    // native dependency imports one of the two rows above and links none of it,
    // which is why this lives behind `/animated` rather than at the root.
    // Raised for `backgroundColor` (the core cost, plus a little where the adapter
    // forwards the prop) — see "blob only" in core's `scripts/size.ts`.
    // Raised from 10_370 by 55 B for `defs` and `paint`: the core cost alone. This adapter does
    // not take them (no markup to put them in) — see "blob only" in core's `scripts/size.ts`.
    name: "@blobatar/react-native animated",
    budget: 10_425,
    // Reanimated and worklets are external for the reason the native modules
    // already here are: they are a JavaScript half bolted to a native half that
    // the consumer's app links once. Their bytes are not this package's to
    // report, and bundling a private copy would not be waste but a broken app.
    external: [
      "react", "react/jsx-runtime", "react-native", "react-native-svg",
      "react-native-reanimated", "react-native-worklets",
    ],
    ext: "tsx",
    source: `import { AnimatedBlobatar } from "@blobatar/react-native/animated";
             globalThis.x = AnimatedBlobatar;`,
  },
  {
    // The morph, and the row that is the whole argument for it being a second
    // component rather than a `morph` prop on the one above.
    //
    // 5904 B measured against that row's 4804, so the morph is ~1.1 kB gz: the
    // pose interpolation, the per-eye transform composition and the colour
    // fade in core, plus a bezier and a `requestAnimationFrame` loop here. As a
    // prop it would have been reachable from the still component and every
    // React Native consumer would have carried it, including the grid of
    // avatars that is most of the usage. As a separate export a bundler drops
    // all of it, which is what the row above is now asserting rather than
    // assuming. The two rows are only meaningful together, and a change that
    // moves both by the same amount is core getting bigger while a change that
    // moves only this one is the morph getting bigger.
  // +60 B gz on every row that animates, and it is one cause across all of
  // them: the seeded timings a blobatar's loops run on are now derived once, by
  // `motionSeeds`, and `motionVars` serializes that rather than computing its
  // own. React Native has no stylesheet to read custom properties out of, so it
  // needs the numbers; the web needs the strings; and two derivations of them
  // would be two crowds drifting apart, which is the one property in the whole
  // motion layer that a grid actually shows. The cost is a named object with
  // ten keys that minification cannot mangle.
    // 6034 B, up ~170 from the morph's first release. That is the morph's
    // bookkeeping becoming a hook two components share rather than a body one
    // component owns: interrupt handling has exactly one subtle rule in it, and
    // a second copy of that rule in the animated component is a worse trade
    // than 170 B. The alternative was measured, not assumed.
    // Raised for `backgroundColor` (the core cost, plus a little where the adapter
    // forwards the prop) — see "blob only" in core's `scripts/size.ts`.
    // Raised from 6290 by 50 B for `defs` and `paint`: the core cost alone. This adapter does
    // not take them (no markup to put them in) — see "blob only" in core's `scripts/size.ts`.
    name: "@blobatar/react-native morph",
    budget: 6340,
    external: ["react", "react/jsx-runtime", "react-native", "react-native-svg"],
    ext: "tsx",
    source: `import { MorphingBlobatar } from "@blobatar/react-native";
             globalThis.x = MorphingBlobatar;`,
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
    /*
     * The hook's own code, with the driver external.
     *
     * The number next to it that matters is `@blobatar/react alone` above,
     * still at its 110 B budget: the gaze layer is a separate entry precisely
     * so that importing `Blobatar` never reaches it, and importing this module
     * from `index.tsx` would blow that row rather than this one. Two rows, one
     * claim, and the claim is what a consumer who never gazes pays.
     */
    // Raised from 400 by the `travel` option: +86 B for the effect that writes
    // `--mo-track-travel` inline and remeasures after. That buys the layer's
    // opt-in switch a place in the JS API, where "the driver runs and nothing
    // moves" is otherwise caused by a CSS property nothing in this signature
    // mentions, and it makes the driver's cached write threshold refresh itself
    // rather than being a documented gotcha.
    name: "@blobatar/react/gaze alone",
    budget: 470,
    external: ["react", "blobatar", "blobatar/gaze"],
    ext: "tsx",
    source: `import { useGaze } from "@blobatar/react/gaze";
             globalThis.x = useGaze;`,
  },
  {
    /* The hook with the driver resolved, which is what the import actually
       costs a page that opts in. */
    // Raised from 1550 when §4.5 became a spherical projection rather than a
    // translate: the growth is all `blobatar/gaze`, whose own entry carries the
    // reasoning. The number to read beside it is `@blobatar/react alone`, which
    // did not move — this is what a consumer who gazes pays, and the 76 B above
    // is still what everybody else does.
    // …and to 2650 for the target vocabulary, which is the same story again:
    // the driver grew by the element-watching and the stand-down ramp, the hook
    // shrank a little by losing `home()` to `lookAt("rest")`, and
    // `@blobatar/react alone` did not move.
    name: "@blobatar/react/gaze shipped",
    budget: 2650,
    external: ["react"],
    ext: "tsx",
    source: `import { useGaze } from "@blobatar/react/gaze";
             globalThis.x = useGaze;`,
  },
  /*
   * One row per binding, and the point of having four is the comparison. Each
   * is the adapter's own code with the driver external, so a number that grows
   * out of line with the others is a binding doing something the layer does not
   * need — and the row that matters beside every one of them is its adapter's
   * `alone` row, which must not move at all: the gaze is a separate entry
   * precisely so that importing `Blobatar` never reaches it.
   */
  {
    // 381 B measured. A composable with a `watch` and a scope-dispose, which is
    // what it costs to be handed a ref instead of handing one back.
    name: "@blobatar/vue/gaze alone",
    budget: 410,
    external: ["vue", "blobatar", "blobatar/gaze"],
    ext: "ts",
    source: `import { useGaze } from "@blobatar/vue/gaze";
             globalThis.x = useGaze;`,
  },
  {
    // 318 B measured, and the smallest of the four because Solid does not
    // re-render: there is no callback ref to keep, no dependency array and no
    // declared target to re-apply, so the binding is the driver's two seams and
    // an `onCleanup`.
    name: "@blobatar/solid/gaze alone",
    budget: 350,
    external: ["solid-js", "blobatar", "blobatar/gaze"],
    ext: "ts",
    source: `import { createGaze } from "@blobatar/solid/gaze";
             globalThis.x = createGaze;`,
  },
  {
    // 450 B measured against React's 444 B, which is the number worth reading:
    // the two files are the same hook, and a divergence here would mean one of
    // them had grown a behaviour the other lacks.
    name: "@blobatar/preact/gaze alone",
    budget: 480,
    external: ["preact", "preact/hooks", "blobatar", "blobatar/gaze"],
    ext: "ts",
    source: `import { useGaze } from "@blobatar/preact/gaze";
             globalThis.x = useGaze;`,
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
    // Raised from 1030 by 20 B for `defs` and `paint`, the two props the adapter now
    // forwards — see "blob only" in core's `scripts/size.ts`.
    name: "@blobatar/solid alone",
    budget: 1050,
    external: ["solid-js", "solid-js/web", "blobatar", "blobatar/internal", "blobatar/uri"],
    ext: "tsx",
    source: `import { Blobatar } from "@blobatar/solid";
             globalThis.x = Blobatar;`,
  },
  {
    // 654 B measured, 525 before the split. The row that would catch
    // `react-native-svg` or
    // `react-native` being bundled in, which on this platform is not a size
    // regression but a broken app, since the native halves are linked once and
    // a private JavaScript copy would be talking to nothing.
    name: "@blobatar/react-native alone",
    budget: 700,
    external: ["react", "react/jsx-runtime", "react-native", "react-native-svg", "blobatar", "blobatar/internal", "blobatar/uri"],
    ext: "tsx",
    source: `import { Blobatar } from "@blobatar/react-native";
             globalThis.x = Blobatar;`,
  },
  {
    // 570 B measured.
    // Raised from 600 by 15 B for `defs` and `paint`, the two props the adapter now
    // forwards — see "blob only" in core's `scripts/size.ts`.
    name: "@blobatar/preact alone",
    budget: 615,
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
  // 5400 B measured, and larger than any bundled row above for a reason worth
  // stating rather than optimizing away: this is source, so it ships its
  // comments. The consumer's compiler drops them before they reach a bundle, so
  // the number a *user* pays is smaller than this one and is not measurable
  // here — what this row gates is the wire, which is the only part this package
  // controls.
  //
  // 2613 B of that until `./gaze` arrived, and the jump is the one place this
  // row reads differently from the built adapters above. There, a second entry
  // costs a consumer nothing until they import it, and `@blobatar/react alone`
  // is the row that says so. A tarball has no entries: `src/gaze.js` crosses
  // the wire whether or not anything imports it, and the subpath only keeps it
  // out of the *bundle*. So this number covers both entries on purpose, and the
  // promise the subpath makes is the one the packaging test states — `index.js`
  // names nothing in `gaze.js`.
  { name: "@blobatar/svelte", from: "../svelte/src", budget: 5450 },
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
