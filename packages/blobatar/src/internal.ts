/**
 * What an adapter needs and a consumer does not.
 *
 * `_parts` and `_layout` used to be reachable only as underscored exports of
 * `blobatar.ts` — "underscored because the shape of this object is not public
 * API". That claim held for exactly as long as every caller lived in this
 * directory. The adapters are separate packages now, so the seam crosses a
 * published boundary, and a documented-private object that is nonetheless
 * load-bearing published surface is a convention that stops being one the first
 * time somebody outside the repo finds it.
 *
 * So it is stated instead of implied.
 *
 * ## The contract
 *
 * **This entry point is for the `@blobatar/*` adapters.** Its shape changes
 * only on a major, together with every adapter, and it carries no deprecation
 * period of its own — a minor may add to it, never rename or remove.
 *
 * That rule is only truthful because the whole set is released in lockstep:
 * `blobatar` and every `@blobatar/*` package publish the same version, always
 * (see `.changeset/config.json`). A consumer who imports from here is opting
 * into an interface whose stability guarantee is "the adapters were updated in
 * the same commit" — which is a real guarantee, and a different one from what
 * `blobatar`, `blobatar/blob` and `blobatar/uri` offer.
 *
 * Nothing here is needed to render a blobatar. If you are reaching for `_parts`
 * to build markup, `blobatar()` and `blobatarUri()` are the public answers and
 * they are not going to move under you.
 */

import { serializeVars as serialize } from "./animate";

export { _layout, _parts } from "./blobatar";
export type { Animate, BlobatarOptions, Expression, Travel } from "./blobatar";
export type { Palette } from "./color";
export type { TraitOverrides, Traits } from "./traits";

/**
 * Re-exported through a binding rather than `export { serializeVars }`, and the
 * indirection is load-bearing for the same reason `VERSION` is in
 * `src/index.ts`.
 *
 * On Bun 1.3.14, bundling an entry whose body is *nothing but* named re-exports
 * against a package declaring `sideEffects` yields a module re-exporting names
 * it never imported, and Node throws `SyntaxError: Export 'a' is not defined in
 * module` on link. Everything else in this file is a re-export, so one real
 * binding in the module body is what keeps the graph from being dropped.
 *
 * The shipping build does not split, which is what keeps this from mattering
 * today — but `scripts/smoke.mjs` links this entry under Node on every build,
 * and it is the line that keeps it linking if splitting is ever turned back on.
 * Collapsing it into the re-export list above is not a tidy-up.
 */
export const serializeVars = serialize;
