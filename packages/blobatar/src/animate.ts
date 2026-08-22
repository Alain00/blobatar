import type { Traits } from "./traits";

/**
 * Idle animation for the `blob` variant. See docs/motion-spec.md.
 *
 * `"hover"` animates one blobatar at a time, which is both the aesthetic answer
 * (ambient motion seen constantly is motion worth removing) and the performance
 * one. `"always"` is the escape hatch for the single-blobatar case — a profile
 * header, an onboarding screen — where that frequency argument does not apply.
 */
export type Animate = "hover" | "always";

/**
 * Whole-figure directional travel, as an idle-loop channel.
 *
 * Four cardinal directions named as they read on screen, plus `"seeded"`, which
 * lets the name pick the direction — a uniform pick over the four, drawn from
 * the `travel.dir` trait, so a grid of seeded blobatars walks every way at
 * once instead of marching in formation.
 *
 **Honored by the framework adapters only**, exactly like `animate`: the string
 * API returns static markup regardless, and the rationale is measured rather
 * than aesthetic — see `BlobatarOptions.travel` in `src/render.ts`.
 */
export type Travel = "rtl" | "ltr" | "ttb" | "btt" | "seeded";

const DIRECTIONS = ["ltr", "rtl", "ttb", "btt"] as const;

/**
 * Per-blobatar travel timing and direction, as custom properties.
 *
 * The same three decisions `motionVars` documents apply here unchanged: seeded
 * offsets (a grid that sets off in unison reads as a heartbeat), negated phase
 * at the source (a positive delay postpones rather than offsets), and
 * string-addressed trait keys (adding `travel.*` cannot perturb any existing
 * blobatar).
 *
 * The direction vector is emitted as its endpoint offset — one signed pair,
 * `--mo-tx`/`--mo-ty` in viewBox units — rather than as an angle or a named
 * direction for the stylesheet to decode. CSS picks the four directions apart
 * by arithmetic, not by selectors, so one shared `@keyframes` serves all of
 * them and no per-direction rule ever exists.
 *
 * The lean (`--mo-t-lean`) is a small seeded roll the figure holds *into* its
 * direction of travel. It is capped well under the 12° static lean ceiling the
 * wrap layer establishes (§4.7): lean carries identity, and travel decorates it
 * rather than overwriting who the blobatar is.
 */
export function travelVars(t: Traits, travel?: Travel): Record<string, string> {
  // An explicit direction wins; `"seeded"` (or nothing) lets the hash pick.
  const dir = travel && travel !== "seeded" ? travel : t.pick("travel.dir", DIRECTIONS);
  const dist = Math.round(t.num("travel.dist", 3, 9) * 100) / 100;
  const period = Math.round(t.num("travel.period", 9000, 16000));
  return {
    "--mo-tx": `${dir === "ltr" ? dist : dir === "rtl" ? -dist : 0}px`,
    "--mo-ty": `${dir === "ttb" ? dist : dir === "btt" ? -dist : 0}px`,
    "--mo-t-period": `${period}ms`,
    "--mo-t-phase": `${-Math.round(t.num("travel.phase", 0, period))}ms`,
    "--mo-t-lean": `${Math.round(t.num("travel.lean", -2, 2) * 100) / 100}deg`,
  };
}

/**
 * Root class. Amplitude, and therefore everything else, hangs off this.
 *
 * `mo-expr` marks "wearing a non-idle expression" and exists for exactly one
 * reason: a transition takes its duration from the state it is heading *to*, so
 * the class is what lets adopting an expression and returning to idle run on
 * different clocks. It selects no pose of its own — the pose is eight custom
 * properties, and this file never learns which expression is on.
 */
export const rootClass = (mode: Animate, expressive?: boolean) =>
  `mo-root${mode === "always" ? " mo-always" : ""}${expressive ? " mo-expr" : ""}`;

/**
 * Per-blobatar timing, as custom properties for the stylesheet to read.
 *
 * A grid where every blobatar breathes in unison does not read as a crowd of
 * creatures; it reads as a heartbeat. Seeded offsets are what make it a crowd,
 * and they are the single most load-bearing 40 bytes in the motion layer.
 *
 * Delays are negated **here**, at the source. A positive `animation-delay`
 * postpones the start rather than offsetting the phase, so the whole grid would
 * still open in unison — after an awkward pause. Same keystroke, opposite
 * behavior, and it only shows on first paint.
 *
 * Breathe and bob get independent offsets. Sharing one preserves the drift
 * between their two periods but locks every blobatar into the *same* drift, which
 * is the unison problem again, one level up.
 *
 * These keys cost nothing in compatibility: traits are string-addressed, so
 * adding `motion.*` cannot perturb any existing blobatar.
 */
export function motionVars(t: Traits): Record<string, string> {
  const ms = (v: number) => `${-Math.round(v)}ms`;
  const r2 = (v: number) => String(Math.round(v * 100) / 100);
  const blink = Math.round(t.num("motion.blink", 3500, 6500));
  const saccade = Math.round(t.num("motion.saccade", 4200, 7600));
  const lookX = t.num("motion.lookX", 1, 2.2);
  const lookY = t.num("motion.lookY", 0.8, 1.7);

  return {
    "--mo-phase": ms(t.num("motion.phase", 0, 2800)),
    "--mo-bob-phase": ms(t.num("motion.bob", 0, 3400)),
    "--mo-blink": `${blink}ms`,
    "--mo-blink-phase": ms(t.num("motion.blinkPhase", 0, blink)),

    // Where this blobatar looks when it glances. One shared `@keyframes` visits
    // the same *sequence* of fixations on every blobatar, so without a per-seed
    // direction the whole grid would look left, then up, then right together —
    // the unison problem again, and more legible than the original because a
    // sequence is easier to spot than a phase.
    //
    // Magnitude and sign are drawn separately so the value cannot land near
    // zero: a seed that draws 0.02 would simply never appear to look anywhere.
    //
    // Magnitude ships as its own variable alongside the signed one. The wrap
    // layer (§4.7) foreshortens by *how far* the eyes travel, which is
    // sign-independent, and CSS has no portable `abs()` to recover it — Safari
    // only got one in 17.2. Emitting both is four bytes against a fallback.
    "--mo-look-x": r2(lookX * (t.bool("motion.lookXFlip") ? -1 : 1)),
    "--mo-look-mx": r2(lookX),
    // Still short of horizontal — eyes rove side to side more than up and down
    // — but not by much, because the fixations are now real compass directions
    // rather than scaled copies of one vector, and a squashed vertical range
    // would collapse "up" and "up-left" into the same look.
    "--mo-look-y": r2(lookY * (t.bool("motion.lookYFlip") ? -1 : 1)),
    "--mo-look-my": r2(lookY),
    "--mo-saccade": `${saccade}ms`,
    "--mo-saccade-phase": ms(t.num("motion.saccadePhase", 0, saccade)),
  };
}

/** `--a:1;--b:2` — for the string API, which has no style object to hand. */
export const serializeVars = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
