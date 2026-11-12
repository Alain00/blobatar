import type { Animate } from "./animate";
import { palette as buildPalette, type Palette } from "./color";
import type { Expression, Posable } from "./expression";
import { superellipse } from "./shape";
import { traits, type TraitOverrides, type Traits } from "./traits";

export interface BlobatarOptions {
  /** Emits width/height attributes. Omit to let CSS size it (the viewBox always scales). */
  size?: number;
  /** Overrides the default backdrop. `false` renders transparent. */
  background?: boolean | "square" | "circle" | "squircle";
  /**
   * The backdrop's fill color. Has no effect unless a backdrop is drawn —
   * there is no plate to color otherwise.
   *
   * Unlike `palette: { bg }`, this keeps the contrast guarantee: the body is
   * pushed off this color the way it is pushed off the default plate. That
   * needs a color it can measure, so it holds for `#rgb`/`#rrggbb` only; any
   * other CSS color is painted as given. `palette.bg` wins if both are given.
   */
  backgroundColor?: string;
  /** Overrides specific palette entries. Overridden colors bypass the contrast guarantee. */
  palette?: Palette;
  /**
   * SVG markup for a `<defs>` block: the paint servers (gradients, patterns,
   * an image inside a pattern) that `paint` can point at. Emitted as given,
   * unescaped, so pass nothing you did not author.
   *
   * Coordinates are the blobatar's own, a 100 × 100 viewBox, so a pattern that
   * should cover the whole figure is `patternUnits="userSpaceOnUse"` with
   * `width="100" height="100"`. Draws nothing until something points at it.
   *
   * Ids are document-global once the SVG is inline (the string API, or an
   * adapter with `animate`), so one paint server should keep one id and two
   * different ones two different ids. In `blobatarUri` and in the adapters'
   * static `<img>` the SVG is its own document and ids cannot collide; there an
   * `<image>` inside `defs` can load `data:` URIs only, because an image
   * document may not fetch anything else, and `blobatarUri` writes attribute
   * values in single quotes, so keep those out of yours (base64 has none).
   *
   * Web SVG only. `@blobatar/react-native` and the Flutter port draw with
   * primitives and have no markup to put it in, so they do not take it.
   */
  defs?: string;
  /**
   * What the body is painted with, in place of its color: `url(#id)` for a
   * paint server from `defs`, or from elsewhere in the page when the SVG is
   * inline. Any CSS paint is accepted.
   *
   * ```ts
   * blobatar(user.email, {
   *   defs: `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
   *            <stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#818cf8"/>
   *          </linearGradient>`,
   *   paint: "url(#sky)",
   * });
   * ```
   *
   * The color is still resolved, and still does its work: the eyes keep the
   * contrast they were given against it, and a tinting `expression` still
   * works from it. That is the difference from `palette: { head }`, which
   * replaces the color, so a tinting pose has no color to mix and the body
   * comes out a flat color with the paint gone. A tint reaches the eyes and not
   * the body, whose paint is yours.
   * Set `palette.head` as well to choose the color the eyes are measured
   * against, for a paint of a known lightness.
   *
   * The body only. The eyes and the backdrop are colors: `palette` and
   * `backgroundColor`. Web SVG only, like `defs`.
   */
  paint?: string;
  /** Locks the hue in degrees, so the name drives shape only. */
  hue?: number;
  /**
   * Locks the tone as a 0–1 position in the swatch set, pale to ink.
   *
   * The swatches are banded with half-open edges, so an exact `1` sits on the
   * top edge rather than under it and falls back to the first swatch: `1`
   * renders what `0` renders. Reach for ink with `0.999`.
   */
  tone?: number;
  /**
   * Pins individual traits, so the name drives only what you leave out.
   *
   * Each value is the 0–1 position the hash would have produced for that key —
   * the same units the layout reads, so `{ "eye.gap": 1 }` is the top of
   * whatever range `eye.gap` is declared over rather than a measurement in
   * viewBox units. Values outside [0, 1) are clamped.
   *
   * ```ts
   * // Always a sun, always wide eyes — colour and everything else per name.
   * blobatar(user.email, { traits: { shape: 0.95, "eye.ratio": 0 } })
   * ```
   *
   * Pin every trait and the name stops mattering, which is how you build one
   * fixed blobatar: pass any constant string alongside a full map.
   *
   * The layout still runs in full, so the containment guarantees hold under any
   * combination — an eye cluster that would not fit is scaled down by `fit`
   * exactly as a hashed one is. That also means an extreme value can land short
   * of where you asked; `_layout` reports what it resolved to.
   *
   * Overlaps with `hue` and `tone`, which state the same two traits in friendlier
   * units. Those win: `hue` is degrees, `traits.hue` is a 0–1 position.
   */
  traits?: TraitOverrides;
  /** Applies NFC + trim + lowercase to the name. Default true. */
  normalize?: boolean;
  /** Enforces the minimum contrast ratios. Default true. */
  contrast?: boolean;
  /** Adds a <title> for screen readers. */
  title?: string;
  /**
   * Idle animation. Off by default.
   *
   * Requires `import "blobatar/motion.css"`, and requires the blobatar to be
   * inline SVG — content inside an `<img>` is an isolated document that hover
   * cannot reach. `@blobatar/react` and `@blobatar/vue` switch rendering mode
   * for you; the string API is already inline.
   *
   * **Honored by the framework adapters (`@blobatar/react`, `@blobatar/vue`)
   * only.** `blobatar()` returns static markup regardless: a branch on
   * `animate` inside it keeps the motion module alive for every caller,
   * animating or not, which measured at ~190 B. An animated string API wants
   * its own entry point, not a branch here.
   */
  animate?: Animate;
  /**
   * Which pose the blobatar holds. Import one from `blobatar/expression`.
   *
   * ```ts
   * import { happy } from "blobatar/expression";
   * blobatar(name, { expression: happy });
   * ```
   *
   * Passed as a value rather than named as a string so that the expressions you
   * do not import cost nothing — and so that the core carries no pose code at
   * all. Omitting it is `idle`; `idle` is also exported, for when writing it
   * reads better than `undefined`.
   *
   * Set by you and held until you change it — nothing here returns to idle on
   * its own, and there are no timers. A burst is `setExpression(happy)` followed
   * by your own `setTimeout`, which is four lines in your code and zero bytes in
   * this bundle.
   *
   * Independent of `animate` in both directions. Without `animate` the blobatar
   * renders the pose statically, which is what makes this work in the string API
   * and under `prefers-reduced-motion`; **the morph between poses requires
   * `animate`**, because that is what puts the blobatar in inline SVG where CSS
   * can reach it. Setting `expression` never turns `animate` on for you: that
   * would silently flip a 400-blobatar grid from 400 `<img>`s to 400 SVG trees.
   *
   * `idle` emits byte-identical markup to omitting the option.
   */
  expression?: Expression;
}

export interface Style<L> {
  layout(t: Traits): L;
  /**
   * `mo` is set when animating, absent otherwise. It is a flag rather than the
   * root class it used to be: the root `<g>` is the caller's now, because a
   * class inside this string is a class inside `dangerouslySetInnerHTML`. See
   * `makeParts`.
   */
  render(l: L, p: Palette, mo?: boolean): string;
  background: boolean | "square" | "circle" | "squircle";
}

/**
 * Applies a static pose, if an expression was asked for.
 *
 * The animated path deliberately does not come through here: there, the pose is
 * eight custom properties and the CSS composes it, so baking it into geometry as
 * well would apply it twice.
 */
export function posed<L>(l: L, opts: BlobatarOptions, animate?: unknown) {
  const e = opts.expression;
  if (animate || !e) return { l, wrap: "" };
  return e.bake(l as L & Posable, e.p);
}

/**
 * Applies a pose's tint, if it has one.
 *
 * Called on the static path only, for the mirror-image of the reason `posed`
 * skips the animated one: when animating, the fills have to stay off the markup
 * entirely — `parts.inner` may not vary with the expression — so the tinted
 * colors go out as `--mo-head`/`--mo-eye` in `vars` instead and the stylesheet
 * puts them on. Same two colors, resolved once, serialized into whichever half
 * of the split can carry them.
 */
export const tinted = (p: Palette, e?: Expression) => (e?.tint ? e.tint(p, e.p) : p);

/** Wraps the body in the pose transform, when there is one. */
const wrap = (body: string, t: string) =>
  t ? `<g transform="${t}">${body}</g>` : body;

const escape = (s: string) =>
  s.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
  );

/**
 * `plate` is the style's default backdrop, needed here because `backgroundColor`
 * only joins the contrast chain when a plate is actually drawn: pushing the body
 * off a color that never reaches the screen would change the blobatar for
 * nothing.
 */
export function resolve(
  seed: string,
  opts: BlobatarOptions,
  plate: Style<unknown>["background"],
) {
  const t = traits(seed, opts.normalize ?? true, opts.traits);
  return {
    t,
    palette: {
      ...buildPalette(
        opts.hue ?? t.num("hue", 0, 360),
        opts.contrast ?? true,
        opts.tone ?? t("tone"),
        (opts.background ?? plate) === false ? undefined : opts.backgroundColor,
      ),
      ...opts.palette,
    } as Palette,
  };
}

/** Screen-reader label, if one was asked for. */
const label = (opts: BlobatarOptions) =>
  opts.title ? `<title>${escape(opts.title)}</title>` : "";

/** The caller's paint servers, if any were given. */
const defs = (opts: BlobatarOptions) =>
  opts.defs ? `<defs>${opts.defs}</defs>` : "";

/**
 * The palette the figure is drawn with: the resolved one, with the body's paint
 * swapped in last. After the tint rather than before it, because the tint works
 * from colors and a `url()` is not one.
 */
const drawn = (p: Palette, opts: BlobatarOptions): Palette =>
  opts.paint ? { ...p, head: opts.paint } : p;

/** The plate behind the figure, as geometry rather than as markup. */
export interface Backdrop {
  d: string;
  fill: string;
}

/**
 * The backdrop is the style's concern to default, not the renderer's.
 *
 * Returns the path rather than a serialized `<path>` because the framework
 * adapters (React, Vue) have to draw it as a real element: it sits *outside*
 * the motion root, so it cannot ride along in the innerHTML string that the
 * root `<g>` now owns.
 */
export function backdrop<L>(
  style: Style<L>,
  opts: BlobatarOptions,
  p: Palette,
): Backdrop | undefined {
  const bg = opts.background ?? style.background;
  if (bg === false) return undefined;
  return {
    d:
      bg === "square"
        ? "M0 0H100V100H0Z"
        : superellipse({
            cx: 50,
            cy: 50,
            rx: 50,
            ry: 50,
            n: bg === "circle" ? 2 : 6,
          }),
    // `Palette` is partial because each style fills only the slots it needs,
    // but every ramp in `color.ts` fills `bg` — and a backdrop with no colour
    // is not a thing this can be asked to draw.
    fill: p.bg!,
  };
}

const plate = (b?: Backdrop) => (b ? `<path d="${b.d}" fill="${b.fill}"/>` : "");

/**
 * What a motion factory hands back: the root class, and the seeded timing to
 * put on the outer element.
 *
 * Passed *in* rather than imported, so `src/animate.ts` never enters a bundle
 * that does not animate. That indirection is the entire reason the static path
 * still costs what it did before the motion layer existed — a plain
 * `if (opts.animate)` here would pull the motion module into every consumer,
 * animating or not.
 */
export interface Motion {
  cls: string;
  vars: Record<string, string>;
}

/**
 * The palette is handed to the factory because a tinting expression needs it:
 * the hot pair it mixes toward is derived from the colors the blobatar is actually
 * wearing, overrides included. It arrives as an argument rather than being
 * looked up so that `src/color.ts`'s `tinted()` stays reachable only from an
 * expression value — the same indirection that keeps `animate.ts` out of static
 * bundles.
 */
export type MotionFactory = (t: Traits, p: Palette) => Motion;

/** Binds one package major's frozen style into `blobatar(name, opts)`. */
export function makeBlobatar<L>(style: Style<L>) {
  return (name: string, opts: BlobatarOptions = {}): string => {
    const { t, palette } = resolve(name, opts, style.background);
    const p = tinted(palette, opts.expression);
    const dim = opts.size ? ` width="${opts.size}" height="${opts.size}"` : "";
    const pose = posed(style.layout(t), opts);
    // The pose wraps the figure but not the backdrop, for the same reason the
    // motion groups sit inside `style.render` — a plate that scales and leans
    // with the creature stops being a plate.
    const body =
      label(opts) +
      defs(opts) +
      plate(backdrop(style, opts, p)) +
      wrap(style.render(pose.l, drawn(p, opts)), pose.wrap);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${dim}>${body}</svg>`;
  };
}

/**
 * The blobatar in the pieces a renderer that owns the outer element needs.
 *
 * Split out from `makeBlobatar` because the framework adapters (React, Vue)
 * have to own the `<svg>` when animating — they need real element props on it
 * — and recovering the inner markup by regex-stripping a serialized `<svg>` is
 * the kind of thing that works until someone passes a `title` containing a `>`.
 *
 * The split runs one level deeper than that, and this is the load-bearing part:
 * **nothing that varies with `expression` may appear in `inner`.** `inner` is
 * handed to `dangerouslySetInnerHTML`/`innerHTML`, so a single byte of drift
 * makes the adapter replace the whole subtree — and a brand-new element has no
 * previous computed value, which is precisely the rule that stops transitions
 * running on first style resolution. The morph would not be slow or wrong; it
 * would not exist, and every idle animation underneath would restart from
 * phase zero on top of it. So the root class lives in `cls` and the pose lives
 * in `vars`, both of which land on real attributes that the adapter can diff
 * in place, and the backdrop comes back as geometry because it belongs outside
 * the root `<g>` — a plate that hover-lifts with the creature stops being a
 * plate.
 *
 * `test/expression.test.ts` pins the invariant directly.
 */
export function makeParts<L>(style: Style<L>) {
  return (
    name: string,
    opts: BlobatarOptions = {},
    motion?: MotionFactory,
  ) => {
    const { t, palette: p } = resolve(name, opts, style.background);
    const mo = motion?.(t, p);
    const pose = posed(style.layout(t), opts, mo);

    return {
      /** Goes on the root `<g>`, which the caller renders. */
      cls: mo?.cls,
      bg: backdrop(style, opts, p),
      /**
       * Everything below the root `<g>`. Free of both of the above.
       *
       * The paint servers lead it, inside the root rather than beside it, so no
       * adapter has a new child to render. `defs` does not vary with the
       * expression, so the invariant above holds. It sits outside the pose wrap
       * because nothing in it is drawn: a paint server is laid out in the space
       * of the element it fills, so the pose still carries the paint with it.
       */
      inner: defs(opts) + wrap(style.render(pose.l, drawn(p, opts), !!mo), pose.wrap),
      vars: mo?.vars,
    };
  };
}
