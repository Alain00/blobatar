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
 *
 * **The idle layer is deliberately not here.** It lives at `blobatar/idle`,
 * beside `blobatar/expression` and for the same reason: it is a feature with
 * its own weight, and an entry point everybody imports is the wrong place to
 * put a thing most consumers never animate. It is also a measured decision
 * rather than a tidy one. The loops are keyframe *tables*, and a bundler does
 * not drop an unreferenced array literal the way it drops an unreferenced
 * function, so re-exporting them from here put 2.9 kB of stops into every
 * adapter's bundle, animated or not. `packages/harness/scripts/size.ts` caught
 * it, twice now, for the same underlying reason as the pose roster.
 *
 * The timings go with it, as `idleSeeds`, for the same measurement: they are a
 * dozen numbers off the same traits the stylesheet reads, and putting them here
 * cost every still adapter ~230 B for a function it never calls.
 *
 * The morph's curves and the bezier solver are not here either, and that one is
 * a genuine duplication rather than a placement: `@blobatar/react-native` keeps
 * its own copy of both. Exporting core's from here charges every consumer of
 * this entry point for them, because core's publish build minifies, minifying
 * strips the `/* @__PURE__ *\/` annotations that would let a downstream bundler
 * drop the call, and the annotation is the only thing that made them free. A
 * fifteen-line Newton solver in two packages is the cheaper of the two wrongs,
 * and `motion.css` is the real original of those curves in any case.
 *
 * `_posed`, `poseTransforms`, `lerpPose` and `fadeHex` are the morph, and they
 * are four exports rather than one because the pieces belong to three different
 * modules and none of them may be welded to the others. `_posed` is the figure
 * with the pose left as numbers; `poseTransforms` is the composition, which
 * lives beside `bakePose` because the two must be read together; `lerpPose` is
 * the interpolation a substrate without CSS transitions has to do itself; and
 * `fadeHex` is the colour travel, which lives with the rest of the colour code.
 * An adapter assembles them and adds nothing of its own, which is ADR-0009's
 * rule and the reason the composition is not in the adapter where it would be
 * more convenient.
 *
 * Exporting them from here does not put them in a static adapter's bundle. Each
 * is a plain function declaration in a module whose top level is literals, so
 * `@blobatar/react-native`'s static path drops all four; `packages/harness`
 * gates that.
 *
 * `_marks` is the newest of the three and the only one added since the split.
 * It is here rather than in a public entry point for the same reason as the
 * other two, since its shape is the adapters' business, and it was addable at all
 * because this entry point's contract permits a minor to add. React Native has
 * no `innerHTML`, so `_parts` cannot serve it; `_marks` is the same figure as
 * data.
 */

import { serializeVars as serialize } from "./animate";

export { _layout, _marks, _parts, _posed } from "./blobatar";
export type { Animate, BlobatarOptions, Expression, Mark, Season } from "./blobatar";
export { fadeHex } from "./color";
export type { Palette } from "./color";
export { lerpPose, poseTransforms } from "./morph";
export type { Pose, Posable } from "./morph";
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
