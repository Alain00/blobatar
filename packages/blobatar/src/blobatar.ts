import { motionVars, rootClass, type Animate } from "./animate";
import type { Palette } from "./color";
import type { Expression } from "./expression";
import {
  backdrop, makeBlobatar, makeParts, posed, resolve, tinted,
  type BlobatarOptions,
} from "./render";
import { style } from "./styles/blob";
import { marks, type Layout, type Mark } from "./styles/compose";
import type { Traits } from "./traits";

export type { BlobatarOptions, Animate, Expression, Mark };

/**
 * Renders a deterministic blobatar as SVG markup.
 *
 * The same name always produces the same output within a major version. The
 * numeric ranges in `styles/compose.ts`, the bands in `styles/blob.ts`, and the
 * tone set are all part of that contract. Changing them requires a new major.
 */
export const blobatar = makeBlobatar(style);

/**
 * Only constructed when someone actually animates, so it tree-shakes away.
 *
 * The pose rides along here rather than in `makeParts` because this is already
 * the seam that keeps the motion modules out of static bundles — and when
 * animating, the pose is custom properties on the same element the timing goes
 * on, not geometry. `poseVars` returns nothing at all for `"idle"`.
 */
const motion = (mode: Animate, e?: Expression, paint?: string) => (t: Traits, p: Palette) => {
  // `vars` is also how we know whether to set `mo-expr`: an expression that
  // moves nothing emits nothing, so an empty object *is* idle. That keeps the
  // class in step with the pose without a second notion of "is this idle".
  //
  // The palette goes in because a tinting pose emits its colour endpoints from
  // here — see `hotVars`. `poseVars` ignores it, which is what keeps the colour
  // code out of every bundle that imports no hot expression.
  const pose = e ? e.vars(e.p) : {};
  const c = e?.tint ? e.tint(p, e.p) : p;
  return {
    // `vars` is one of the two things that can make a pose non-idle; a tint is
    // the other. Checking only the first would leave a colour-only expression
    // wearing idle's slower return clock while its geometry never moved.
    cls: rootClass(mode, !!Object.keys(pose).length || !!e?.tint),
    vars: {
      ...motionVars(t),
      // The fills, as custom properties, on every animated `blob` — tinted when
      // the pose tints and identical to the markup's own attributes when it does
      // not. Emitted unconditionally rather than only for hot poses, because the
      // stylesheet's `fill` rules have to resolve to *something* correct on an
      // blobatar wearing no expression, and a `var()` that falls back to nothing
      // makes `fill` inherit black.
      //
      // Cost is ~30 B per animated blobatar. It buys the tint being a plain
      // `transition: fill` in both directions instead of a custom property that
      // disappears mid-morph on the way out.
      // The body's paint, when the caller gave one, goes where the tinted color
      // would: the stylesheet fills the body from this property.
      "--mo-head": paint ?? c.head!,
      "--mo-eye": c.eye!,
      ...pose,
    },
  };
};

/**
 * The `<svg>` contents and its motion custom properties, separately.
 *
 * For renderers that own the outer element themselves — `@blobatar/react` when
 * animating. Underscored because the shape of this object is not public API.
 */
export function _parts(name: string, opts: BlobatarOptions = {}) {
  return makeParts(style)(
    name,
    opts,
    opts.animate && motion(opts.animate, opts.expression, opts.paint),
  );
}

/**
 * The figure as drawing primitives, for a renderer with no markup to hand a
 * string to.
 *
 * For `@blobatar/react-native`, where the substrate is `react-native-svg` and
 * there is no `innerHTML`. Underscored on the same terms as `_parts` and
 * `_layout`: reachable through `blobatar/internal`, whose shape changes only on
 * a major together with every adapter.
 *
 * Baked, and that is not a gap in this function. The whole *idle* motion layer
 * is CSS (a stylesheet, custom properties and a class), so there is nothing
 * for `animate` to mean on a substrate that has none of the three, and a mark
 * carries no motion grouping. `expression` *does* work, because a static pose
 * bakes into the geometry before it gets here.
 *
 * A renderer that needs to *morph* between two poses wants the other half of
 * that: `_posed` below, which hands the figure back before the pose touched it
 * and the pose back as numbers.
 *
 * `transform` is the pose's body wrap, and it is load-bearing rather than
 * decorative: `expression.bake` returns a `translate(0 N)` for any pose that
 * shifts the body, and a caller that draws the marks without it puts every
 * posed blobatar in the wrong place. It is the *only* transform: an eye's
 * rotation is baked into the points of its path by `superellipse`, not carried
 * as an attribute. Empty string when there is no pose.
 */
export function _marks(name: string, opts: BlobatarOptions = {}): {
  bg: ReturnType<typeof backdrop>;
  transform: string;
  marks: Mark[];
} {
  const { t, palette } = resolve(name, opts, style.background);
  const p = tinted(palette, opts.expression);
  const pose = posed(style.layout(t), opts);
  return {
    // Outside the pose wrap, matching `makeBlobatar`. A plate that leans and
    // scales with the creature stops being a plate.
    bg: backdrop(style, opts, p),
    transform: pose.wrap,
    marks: marks(pose.l as Layout, p),
  };
}

/**
 * The figure *unbaked*, with the pose left as numbers, for a renderer that has
 * to morph between two poses itself.
 *
 * The sibling of `_marks` rather than a mode on it, and the split is the point.
 * `_marks` welds the pose into the geometry, which is exactly right for drawing
 * one pose and exactly wrong for travelling between two: a morph that re-bakes
 * regenerates every eye path per frame. So this returns the figure as it was
 * drawn, before any pose touched it, and hands the pose back as the thirteen
 * channels `poseTransforms` turns into one transform per eye. What changes
 * during a morph is those strings and nothing else.
 *
 * Static consumers pay nothing for it. They keep calling `_marks`, whose shape
 * and cost are untouched, and this whole function tree-shakes out of a bundle
 * that never mentions it, which a mode with a branch inside `_marks` could not
 * have offered.
 *
 * ## What comes back
 *
 * `marks` and `eyes` are the same list `_marks` returns, split in two, because
 * the eyes are the only marks a pose moves and each needs a group of its own.
 * They are already in draw order: everything in `marks`, then everything in
 * `eyes`, which is where `marks()` puts them.
 *
 * `eyeFrames` is what `poseTransforms` needs, and it is deliberately the *drawn*
 * centres and lean rather than anything posed: the transforms are built against
 * the geometry as emitted, so a caller cannot accidentally compose a pose onto a
 * figure that already wears one.
 *
 * `fill` and `hot` are the two ends of the colour travel. `hot` is `null` on
 * every pose that does not tint, which is most of them, and it is a finished
 * colour rather than a target, the mix at the pose's own `heat`, so a morph
 * fades between two hex values exactly as `transition: fill` does on the web.
 * See `fadeHex`.
 *
 * `pose` is `undefined` for no expression, which `lerpPose` reads as idle.
 *
 * `expr` is the `.mo-expr` predicate, computed here rather than by the caller
 * because there is already a copy of it in `motion` above and two would drift.
 * It answers "is the blobatar wearing an expression at all", which is what
 * picks the morph's clock: adopting one is quick and returning to idle is
 * slower, and a renderer with no stylesheet has to make that choice itself. It
 * goes through `e.vars` for the same reason `motion` does, since an expression
 * that moves nothing *is* idle and a tint alone is enough to be non-idle.
 *
 * Underscored on the same terms as `_marks`, `_parts` and `_layout`.
 */
export function _posed(name: string, opts: BlobatarOptions = {}) {
  const { t, palette } = resolve(name, opts, style.background);
  const l = style.layout(t) as Layout;
  // Drawn with the *base* palette, because these fills are the start of the
  // travel and not its end. A tinting pose's endpoint rides in `hot`, and a
  // renderer that ignores the morph entirely and draws these gets an untinted
  // blobatar wearing no expression, which is the honest static answer for a
  // figure whose pose has not been applied to it.
  const all = marks(l, palette);
  const e = opts.expression;
  const hot = e?.tint ? e.tint(palette, e.p) : null;
  // The eyes are the tail of the list, and `test/morph.test.ts` holds `marks()`
  // to that rather than leaving it as an assumption two files apart.
  const cut = all.length - l.eyes.length;
  return {
    // Outside everything, matching `_marks` and `makeBlobatar`. A tint moves
    // `head` and `eye` and never `bg`, so the base palette is the right one
    // here whether or not the pose is hot.
    bg: backdrop(style, opts, palette),
    marks: all.slice(0, cut),
    // Narrowed rather than left as `Mark`, because every eye in gen2 is a
    // `superellipse` and therefore a path, and a caller that has to re-check
    // that per eye writes a branch with no second arm. The cast is what the
    // test above it asserts: `test/morph.test.ts` holds `marks()` to drawing
    // the eyes last and to drawing them as paths.
    eyes: all.slice(cut) as Extract<Mark, { kind: "path" }>[],
    eyeFrames: l.eyes.map(({ cx, cy, rx, ry, rot }) => ({ cx, cy, rx, ry, rot })),
    pose: e?.p,
    expr: !!e && (!!Object.keys(e.vars(e.p)).length || !!e.tint),
    fill: { head: palette.head!, eye: palette.eye! },
    hot: hot ? { head: hot.head!, eye: hot.eye! } : null,
  };
}

/**
 * The numeric layout and resolved palette, before serialization.
 *
 * Kept separate from rendering so geometric invariants — features staying
 * inside the body, the body staying inside the frame — can be asserted directly
 * rather than by parsing path data back out of the markup. Underscored because
 * the shape of this object is not public API.
 */
export function _layout(name: string, opts: BlobatarOptions = {}) {
  const { t, palette } = resolve(name, opts, style.background);
  // The cast is private and deliberately narrow: the package style has the
  // body/eyes shape the geometry tests inspect, while `Style` itself remains
  // generic for the renderer.
  const l = style.layout(t) as Layout;
  // Posed here rather than by the caller, so the geometry tests assert against
  // the same numbers the static renderer draws. Only the baked half comes back:
  // the body-level `transform` is the renderer's business, and the test that
  // cares about it (frame containment under a pose that scales the body) applies
  // the pose itself rather than parsing a matrix back out.
  const e = opts.expression;
  const posed = e ? e.bake(l as never, e.p).l : l;
  return {
    // Tinted here too, so a colour assertion can read the same numbers the
    // static renderer paints rather than the ramp they came from.
    palette: (e?.tint ? e.tint(palette as Palette, e.p) : palette) as Palette,
    ...posed,
  };
}
