export {
  blobatar,
  _layout,
  type Animate,
  type BlobatarOptions,
  type Expression,
  type Travel,
} from "./blobatar";
export {
  palette,
  ramp,
  contrast,
  FLOORS,
  type Palette,
  type Oklch,
  type ColorKey,
} from "./color";
export { traits, type Traits, type TraitOverrides } from "./traits";
export { normalizeSeed } from "./hash";

/**
 * The version this build came from. Asserted against package.json in
 * `test/blobatar.test.ts`, so it cannot drift.
 *
 * It is also load-bearing, which is the part worth knowing before deleting it.
 * On Bun 1.3.14, bundling an entry whose body is *nothing but* named re-exports
 * against a package declaring `sideEffects` produces a module that re-exports
 * names it never imported — `export { a as palette }` with no `a` anywhere —
 * and Node throws `SyntaxError: Export 'a' is not defined in module` the moment
 * it links the file. One real binding in the module body is enough to stop the
 * whole graph being dropped.
 *
 * Still true on Bun 1.3.14, re-confirmed by deleting this const, running the
 * real build with `splitting: true` and linking `dist/index.js` under Node:
 * `SyntaxError: Export 'C' is not defined in module`. The bug has not been
 * fixed in the meantime, it is only being avoided.
 *
 * The shipping build does not split (see `scripts/build.ts` for why), which is
 * what keeps this from being load-bearing today — but it is the line that would
 * make splitting safe if anyone turns it back on, so it is not free to delete.
 *
 * `scripts/smoke.mjs` links the built barrel under Node on every build and is
 * what will tell you if this stops being true.
 */
export const VERSION = "2.4.0";
