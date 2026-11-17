/**
 * The pieces all three components share.
 *
 * Split out when the idle layer arrived, because `AnimatedBlobatar` moved to an
 * entry point of its own: `react-native-reanimated` is a native module with a
 * build step, and a package that imports it at the top of its only entry makes
 * every consumer install it, including the ones that only ever draw a still
 * blobatar. Reaching it through `@blobatar/react-native/animated` is what keeps
 * that peer dependency genuinely optional.
 *
 * Each entry bundles what it uses, so a consumer of both carries two copies of
 * this file's ~1 kB. That is the same trade core makes with its standalone
 * entries, and it is the cheaper half of it: the alternative charges a native
 * dependency to people who never animate.
 */

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  fadeHex,
  lerpPose,
  _posed,
  type BlobatarOptions,
  type Mark,
  type Pose,
} from "blobatar/internal";
import Svg, { Circle, G, Path, type SvgProps } from "react-native-svg";

export type BlobatarProps = {
  /**
   * Who the blobatar is for. A username, a display name, an email, a bot's
   * handle, a user id. Any string, and the same string always renders the
   * same blobatar.
   */
  name: string;
  /**
   * How big to draw it, in points. **Required here, and optional in every
   * other adapter.**
   *
   * On the web, omitting it emits no `width`/`height` and lets CSS size the
   * element, and the viewBox scales to whatever the page decides. React Native has
   * no such fallback, so an unsized `<Svg>` is at best ambiguous and at worst
   * zero pixels of nothing.
   *
   * The alternative was defaulting it here, and that is the one thing ADR-0009
   * says an adapter may never do: a default size is a default that changes the
   * picture, and the core is the only place a default is written down. Making
   * it required moves the platform difference to a compile error at the call
   * site, where it is visible, instead of a blank square at runtime.
   */
  size: number;
  // `defs` and `paint` are absent for the same reason `animate` is: they are SVG
  // markup and paint servers, and `react-native-svg` draws from elements.
} & Omit<BlobatarOptions, "animate" | "size" | "defs" | "paint"> &
  /**
   * `title` is dropped from the passthrough because `SvgProps` declares one of
   * its own and it is not this one. Ours is the screen-reader label every
   * adapter takes, and it is mapped onto React Native's accessibility props
   * below rather than onto an element, because `react-native-svg` has no
   * `<title>`.
   *
   * `viewBox` is dropped because the geometry is drawn in a fixed 100×100 space
   * and a caller who changes it gets a cropped blobatar, not a resized one:
   * `size` is the prop for that. `children` because there is nothing to put
   * inside a blobatar.
   */
  Omit<SvgProps, "viewBox" | "children" | "title">;

/**
 * The two clocks, quoted from `.mo-root.mo-expr` and `.mo-root` in
 * `motion.css`, which is the only other place they are written down.
 *
 * They are copied rather than shared, and nothing can fix that: one of the two
 * renderings of this motion is a stylesheet, so there is no constant a build
 * step could hand to both. What there is instead is this comment and the one
 * beside those rules, and a note there pointing here. **Change them together.**
 *
 * The curve is the part worth not guessing at. `motion.css` documents why it is
 * not the obvious hard ease-out: the pose channels do not all travel the same
 * distance, so a front-loaded curve finishes the eye's squash before the eye
 * appears to have left, and the morph reads as a cut rather than as a fast
 * transition. `ease-in-out` on the way back is CSS's own keyword, spelled here
 * as the bezier it stands for.
 */
const IN = { ms: 300, ease: [0.45, 0.05, 0.5, 1] } as const;
const OUT = { ms: 400, ease: [0.42, 0, 0.58, 1] } as const;

/**
 * `ease-out`, for the amplitude ramp. From `.mo-root`'s
 * `transition-timing-function` on `--mo-amp`, and the one curve in this file
 * that belongs to the idle layer rather than to the morph.
 *
 * Built inside the component that uses it rather than once at module scope, and
 * that is a size decision rather than a style one: `bezier(...)` is a *call*, a
 * bundler will not drop a call it cannot prove side-effect-free, and a
 * module-scope one put the solver into the still and morphing rows too. The
 * size gate caught it, which is what those two rows are for.
 */
const easeOut = () => bezier([0, 0, 0.58, 1]);

/**
 * A CSS `cubic-bezier(x1, y1, x2, y2)`, as a function of elapsed fraction.
 *
 * The curve is a parametric Bézier, so reading `y` at a given `x` means solving
 * for the parameter first, which is what the Newton loop does, from `x` itself
 * as the starting guess. That guess is exact for `linear` and close for
 * everything with control points inside the unit square, so eight iterations is
 * generous; the loop normally exits on the second or third.
 *
 * Both fallbacks return the current estimate rather than throwing or clamping.
 * A stalled derivative means the curve is flat there, where the estimate is as
 * good as any answer, and this is a frame of an animation rather than a place
 * to be principled at the cost of a visible glitch.
 */
function bezier([x1, y1, x2, y2]: readonly [number, number, number, number]) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = ((ax * t + bx) * t + cx) * t - x;
      if (Math.abs(err) < 1e-5) break;
      const d = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return ((ay * t + by) * t + cy) * t;
  };
}

/** The two colours a morph travels between, in the order the marks carry them. */
type Fill = { head: string; eye: string };

/**
 * The outer element, and everything about it that has nothing to do with the
 * pose.
 *
 * Shared by both bodies below rather than duplicated, because the accessibility
 * mapping is the part most likely to be corrected once and forgotten in the
 * other copy.
 */
function Frame({
  size,
  title,
  rest,
  children,
}: {
  size: number;
  title?: string;
  rest: SvgProps;
  children: ReactNode;
}) {
  return (
    <Svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      /*
        The label, and the call the DOM adapters make with `role`/`aria-hidden`,
        made again in React Native's vocabulary. With a `title` this is an image
        with a name; without one it is decoration, and a screen reader that
        walks into a dozen unnamed paths is worse than one that never sees them.

        Both platform spellings of "skip this subtree" are set, because they are
        not aliases: `accessibilityElementsHidden` is iOS and
        `importantForAccessibility` is Android, and setting one leaves the other
        platform reading the shapes.
      */
      accessible={title ? true : undefined}
      accessibilityRole={title ? "image" : undefined}
      accessibilityLabel={title}
      accessibilityElementsHidden={title ? undefined : true}
      importantForAccessibility={title ? undefined : "no-hide-descendants"}
      // Last, so a caller who writes an explicit `width` or `accessibilityLabel`
      // overrides what the props derived. The same rule every other adapter
      // follows, and one `packages/harness` asserts across all of them.
      {...rest}
    >
      {children}
    </Svg>
  );
}

/**
 * The still blobatar, unchanged since this package's first release and
 * deliberately still on `_marks`.
 *
 * It could have been the morphing body frozen at `t = 1`, and that would have
 * been one code path instead of two and a slightly different picture: a baked
 * path rounds after composing the pose and a transformed one rounds before, so
 * the two agree to a hundredth of a unit rather than exactly. A hundredth of a
 * unit is invisible and the equivalence this package is held to is not: the
 * harness compares this adapter's output against `@blobatar/react`'s primitive
 * for primitive, and "equal" there means equal. Adding a morph is not a reason
 * to move a still blobatar by a rounding step.
 */
function useMorph(
  figure: ReturnType<typeof _posed>,
  seed: string,
  opts: Omit<BlobatarOptions, "animate" | "size">,
) {
  // Where the morph is heading. `hot` is already the finished colour at the
  // pose's own `heat`, so there is no mix left to do here. The travel is from
  // whatever is on screen to these two values, on the morph's own clock, which
  // is exactly what `transition: fill` does on the web.
  const to: Fill = {
    head: figure.hot?.head ?? figure.fill.head,
    eye: figure.hot?.eye ?? figure.fill.eye,
  };
  const [shown, setShown] = useState({
    pose: lerpPose(undefined, figure.pose, 1),
    fill: to,
  });
  // The latest committed frame, readable by a caller that has to start from it.
  // A morph interrupted mid-flight begins where the face is, and the face is
  // here.
  const at = useRef(shown);
  at.current = shown;

  // Identity is not enough: `figure` is rebuilt whenever any option changes, so
  // a palette tweak would hand back an equal pose in a new object and start a
  // 300ms morph from a pose to itself. The colours are in the key because a
  // palette change *is* something to fade, and the same key drives both.
  const key = JSON.stringify([figure.pose ?? null, to]);
  // Which blobatar this is, which is every option except the expression.
  //
  // A morph is a change of *expression* on one creature. Handing a component a
  // different `name` is not that: it is a different creature in the same slot,
  // which React does routinely when a list re-renders over new data. That has
  // to cut, and without this it would not quite: the geometry would snap while
  // the colours eased, so one person's palette would fade into another's.
  const ident = JSON.stringify([seed, { ...opts, expression: null }]);

  const seen = useRef(key);
  const seenIdent = useRef(ident);
  const run = useRef<{
    from: { pose: Pose; fill: Fill };
    start: number;
    ms: number;
    ease: (x: number) => number;
  } | null>(null);

  // Decided during render rather than in an effect, so the frame loop a caller
  // starts on this token already has something to do on its first tick. An
  // effect would be a frame late, which is invisible and is also how a loop
  // that stops on "nothing moving" can stop before it ever starts.
  if (seen.current !== key || seenIdent.current !== ident) {
    const cut = seenIdent.current !== ident;
    seen.current = key;
    seenIdent.current = ident;
    if (cut) {
      // A different creature, so there is nothing to travel from.
      run.current = null;
      at.current = { pose: lerpPose(undefined, figure.pose, 1), fill: to };
    } else {
      // Adopting an expression is quick and returning to idle is slower, and
      // the asymmetry is deliberate. See `IN`/`OUT` above.
      const clock = figure.expr ? IN : OUT;
      run.current = { from: at.current, start: 0, ms: clock.ms, ease: bezier(clock.ease) };
    }
  }

  /** Advance to `now`. Returns whether there is still somewhere to go. */
  const step = (now: number) => {
    const r = run.current;
    if (!r) {
      // The cut case, and the mount case. Commit whatever `at` holds, once.
      if (at.current !== shown) setShown(at.current);
      return false;
    }
    // The first callback establishes the origin rather than assuming one.
    // `requestAnimationFrame`'s timestamp is not wall-clock on this platform
    // and subtracting a separately-read `now` from it drifts.
    if (!r.start) r.start = now;
    const u = Math.min(1, (now - r.start) / r.ms);
    const k = r.ease(u);
    setShown({
      pose: lerpPose(r.from.pose, figure.pose, k),
      fill: {
        head: fadeHex(r.from.fill.head, to.head, k),
        eye: fadeHex(r.from.fill.eye, to.eye, k),
      },
    });
    if (u >= 1) run.current = null;
    return u < 1;
  };

  return { shown, step, token: `${key}|${ident}` };
}

/**
 * The morphing blobatar.
 *
 * The whole of the animation is here and none of the motion is: what travels is
 * the thirteen numbers of a `Pose` plus two colours, and core turns those into
 * one transform per eye. No path data is regenerated on any frame, which is the
 * same property the web side has and the reason a morph is affordable at all.
 * `_posed` hands back the figure as drawn, once, and every frame after that is
 * a string on a `<G>`.
 */
function Body({ marks, fill }: { marks: Mark[]; fill: string }) {
  return (
    <>
      {marks.map((m, i) =>
        m.kind === "circle" ? (
          <Circle key={i} cx={m.cx} cy={m.cy} r={m.r} fill={fill} />
        ) : (
          <Path key={i} d={m.d} fill={fill} />
        ),
      )}
    </>
  );
}

/**
 * The options core reads, split away from everything that goes on the element.
 *
 * Shared by the two components below rather than written twice, because it is a
 * list of option names and a list of option names is the thing that silently
 * goes stale in a second copy: a new option added to core reaches both or
 * neither.
 *
 * The three that are not in `opts` are not oversights: core reads none of them.
 * Size is an attribute on the outer element, the label has nowhere to go in a
 * mark, and `name` is the seed rather than an option. What is left in `rest`
 * goes straight onto the `<Svg>`, which is why `traits` is pulled out
 * explicitly: a traits object spread onto a native component is a prop the
 * view bridge has no idea what to do with.
 */
/** What the three components take, once the element props are peeled off. */
export type Parts = {
  seed: string;
  size: number;
  title?: string;
  opts: Omit<BlobatarOptions, "animate" | "size">;
  rest: SvgProps;
};

function split({
  name: seed,
  size,
  background,
  backgroundColor,
  palette,
  hue,
  tone,
  normalize,
  contrast,
  title,
  expression,
  traits,
  ...rest
}: BlobatarProps): Parts {
  return {
    seed,
    size,
    title,
    opts: { background, backgroundColor, palette, hue, tone, normalize, contrast, expression, traits },
    rest,
  };
}

/**
 * A blobatar.
 *
 * There is no `animate` prop, and its absence is the API rather than an
 * oversight.
 *
 * Blobatar's *idle* motion is a stylesheet: `motion.css`, a root class, and a
 * dozen seeded custom properties the CSS reads. React Native has no stylesheet,
 * no custom properties and no CSS transitions, so there is nothing here for
 * `animate` to switch on. Re-expressing the idle spec against Reanimated would
 * make it exist twice, in two languages, drifting, which is the failure
 * ADR-0009 refuses everywhere else. `animate="hover"`, which is the recommended
 * default for a grid on the web, does not even have a trigger on a touch
 * screen.
 *
 * So the prop is absent from the type instead of accepted and ignored. Passing
 * `animate` is a compile error naming this package, which is the cheapest place
 * to learn it.
 *
 * `expression` works fully, and statically: a pose bakes into the geometry
 * before it reaches the marks, which is why it survives here for the same
 * reason it survives in the string API. Setting a new one cuts to it. To
 * animate that change instead, reach for `MorphingBlobatar`, and read there
 * why it is a second component rather than a prop on this one.
 */
export { Frame, Body, split, useMorph, bezier, IN, OUT, easeOut };
export type { Fill };
