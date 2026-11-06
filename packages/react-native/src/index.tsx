/**
 * `@blobatar/react-native`, the React Native and Expo adapter.
 *
 * ## Why this one holds a component when `@blobatar/react` does not
 *
 * `@blobatar/react` is an alias: the component still lives in `blobatar/react`
 * until v3, because that subpath shipped with consumers and core cannot depend
 * on a package that peer-depends on core (ADR-0009). Nothing analogous is true
 * here. There is no `blobatar/react-native` subpath and there never will be.
 * ADR-0009 freezes core's optional peer list at `react` and `vue`, and the
 * moment a third adapter subpath appears the peer list resumes growing and the
 * reason for splitting is gone. So this package holds the real implementation
 * from its first release, the way Solid and Preact do.
 *
 * ## Why it draws elements rather than parsing a string
 *
 * Neither of the two rendering modes the DOM adapters use survives the port.
 * The static one is an `<img>` carrying a `data:image/svg+xml` URI, and React
 * Native's `<Image>` does not decode SVG. The animated one hands `parts.inner`
 * to `dangerouslySetInnerHTML`, and there is no `innerHTML` here at all.
 *
 * `react-native-svg` ships an `SvgXml` that would parse `blobatar()`'s string
 * at runtime, and that was the obvious shape and the wrong one: it puts an XML
 * parser between the renderer and the screen, which is a place the picture can
 * change, and ADR-0009 is explicit that an adapter adds no geometry of its own.
 * So core grew `_marks`, the same figure as drawing primitives, and this file
 * maps them onto elements. What crosses the boundary is data core produced,
 * not markup something re-interpreted.
 *
 * Every silhouette in gen2 draws with `<path>` and `<circle>` and nothing else:
 * no gradients, no filters, no masks, no `currentColor`. That is what makes the
 * mapping total rather than approximate.
 *
 * ## Why it imports no React Native module at all
 *
 * The only two imports here are `react` and `react-native-svg`, and the morph
 * below keeps it that way on purpose. `react-native`'s own entry point is
 * Flow-typed source that Bun cannot parse, which is why `packages/harness`
 * renders this adapter through a stub, so every runtime import of it is a
 * component this workspace can no longer test. `Animated` and `Easing` would
 * have bought a timing loop and a bezier that are together forty lines, at the
 * cost of the only instrument that checks this adapter draws the same blobatar
 * as every other one. `requestAnimationFrame` is a global on this platform and
 * needs no import, so that is what drives the morph.
 *
 * The one thing that trade genuinely costs is reading the OS reduced-motion
 * setting, which lives on `AccessibilityInfo`. See `morph` below for where
 * that lands instead.
 */

import { useEffect, useMemo, useRef } from "react";
import { _marks, _posed, poseTransforms, type BlobatarOptions } from "blobatar/internal";
import { Circle, G, Path, type SvgProps } from "react-native-svg";
import { Body, Costume, Frame, split, useMorph, type BlobatarProps } from "./parts";

export type { BlobatarProps };

function Still({
  seed,
  size,
  title,
  opts,
  rest,
}: {
  seed: string;
  size: number;
  title?: string;
  opts: Omit<BlobatarOptions, "animate" | "size">;
  rest: SvgProps;
}) {
  const dep = JSON.stringify([seed, opts]);
  const figure = useMemo(
    () => _marks(seed, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dep],
  );

  const body = figure.marks.map((m, i) =>
    m.kind === "circle" ? (
      <Circle key={i} cx={m.cx} cy={m.cy} r={m.r} fill={m.fill} />
    ) : (
      <Path key={i} d={m.d} fill={m.fill} />
    ),
  );

  return (
    <Frame size={size} title={title} rest={rest}>
      {/*
        Outside the pose wrap, matching every other renderer: a plate that leans
        and scales with the creature stops being a plate.
      */}
      {figure.bg ? <Path d={figure.bg.d} fill={figure.bg.fill} /> : null}
      {/*
        `transform` is the pose's body wrap and it is load-bearing rather than
        decorative. `expression.bake` returns a `translate(0 N)` for any pose
        that shifts the body, and drawing the marks without it puts every posed
        blobatar in the wrong place. It is the only transform in the figure (a
        season's fit is composed into it): an eye's rotation is baked into the
        points of its path, not carried as an attribute.
      */}
      {figure.transform ? <G transform={figure.transform}>{body}</G> : body}
    </Frame>
  );
}

/**
 * The morph as a state machine with no clock of its own.
 *
 * A hook rather than a component, and it hands back a `step` instead of running
 * a loop, because there are two callers and only one of them owns the only
 * clock. `MorphingBlobatar` runs a frame loop while a morph is in flight and
 * stops. `AnimatedBlobatar` is already running one forever, and a second loop
 * beside it would be two `requestAnimationFrame` callbacks per blobatar per
 * frame, setting state twice, to draw one picture.
 *
 * So the clock is the caller's and the bookkeeping is here. That is what keeps
 * the two components from each carrying their own copy of interrupt handling,
 * which is the part with the subtle rule in it.
 *
 * State holds *what is on screen*, not a progress fraction, and that is what
 * makes an interrupted morph correct without a special case. Setting a new
 * expression half way through the last one starts from wherever the face
 * actually is, so poses chained faster than 300ms flow into each other instead
 * of snapping back to a start the consumer never saw.
 */
function Morphing({
  seed,
  size,
  title,
  opts,
  rest,
}: {
  seed: string;
  size: number;
  title?: string;
  opts: Omit<BlobatarOptions, "animate" | "size">;
  rest: SvgProps;
}) {
  const dep = JSON.stringify([seed, opts]);
  const figure = useMemo(
    () => _posed(seed, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dep],
  );
  const { shown, step, token } = useMorph(figure, seed, opts);
  const first = useRef(true);

  useEffect(() => {
    // Nothing to morph from on the way in. A blobatar that eased out of idle on
    // mount would animate a whole grid of them on first paint, which is the
    // web's rule too: transitions do not run on an element's first style
    // resolution.
    if (first.current) {
      first.current = false;
      return;
    }
    let frame = 0;
    const tick = (now: number) => {
      if (step(now)) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const t = poseTransforms({ eyes: figure.eyeFrames }, shown.pose);

  return (
    <Frame size={size} title={title} rest={rest}>
      {/* Outside the pose wrap, for the reason `Still` gives. */}
      {figure.bg ? <Path d={figure.bg.d} fill={figure.bg.fill} /> : null}
      {/*
        `wrap` is emitted on every pose here, including the identity, where
        `_marks` emits nothing. That is not an oversight and core's
        `poseTransforms` documents it: `bdy` passes through nonzero between two
        poses that both sit at zero, and a group that appears mid-morph is a
        reparent rather than a translate. A season's `fit` goes ahead of it in
        the same list, as `_marks` composes them: a second group would deepen
        every mark by one, and the harness tells the eyes from the body by
        depth.
      */}
      <G transform={figure.fit ? `${figure.fit} ${t.wrap}` : t.wrap}>
        <Body marks={figure.marks} fill={shown.fill.head} />
        {figure.eyes.map((m, i) => (
          <G key={i} transform={t.eyes[i]}>
            <Path d={m.d} fill={shown.fill.eye} />
          </G>
        ))}
        <Costume marks={figure.costume} from={figure.fill.head} to={shown.fill.head} />
      </G>
    </Frame>
  );
}

/**
 * The animated blobatar: the idle layer, and the morph along with it.
 *
 * Six levels of group, which is the same tree `motion.css` decorates, and every
 * level of it earns its place by having a different origin or a different
 * clock.
 *
 * ## Which thread each layer runs on, and why they differ
 *
 * **The loops run on the UI thread.** One `useFrameCallback` writes a clock,
 * one `useDerivedValue` evaluates every loop from it, and each group's
 * transform is a `useAnimatedProps` reading that. No React render happens per
 * frame, which is the entire point: a sidebar of agents all animating at once
 * is the case this is for, and a render per blobatar per frame is what makes
 * that stutter.
 *
 * **The pose runs on the JS thread**, in `useMorph`, and that is deliberate
 * rather than a gap. A morph is a one-shot 300ms transition on a state change
 * the consumer made, not a loop, so it costs about eighteen renders once
 * instead of sixty a second forever. Keeping it here also keeps
 * `poseTransforms` out of a worklet, and that function is the subtlest
 * arithmetic in the library and the one a real browser is used to check. The
 * seesaw reaches it as an extra translate on the outside rather than as a
 * parameter, which composes exactly. See `rockT`.
 */
export function Blobatar(props: BlobatarProps) {
  return <Still {...split(props)} />;
}

/**
 * A blobatar that animates the change from one `expression` to the next
 * instead of cutting to it.
 *
 * Identical to `Blobatar` in every other way, including its props, and a
 * separate export rather than a `morph` prop for one measured reason: the
 * morph is about 1.1 kB gz of machinery, and a prop on a single component is
 * reachable from that component whether or not anybody passes it, so every
 * consumer would carry it. Two components means a bundler drops all of it for
 * an app that never names this one. `packages/harness/scripts/size.ts` gates
 * both numbers, and the row for `Blobatar` is what says the still path stayed
 * free.
 *
 * That is the same trade the roster makes by having expressions be values a
 * consumer imports rather than strings a renderer looks up, and the same one
 * `_marks` and `_posed` make in core.
 *
 * Timed and curved to match `motion.css` exactly: 300ms adopting an
 * expression, 400ms returning to idle, because an expression is a message the
 * consumer sent and yanking it off the face reads as a glitch rather than as a
 * creature settling. The morph itself is core's, channel for channel, and
 * `test/morph.test.ts` there holds a frozen frame of it against the static
 * renderer at every pose.
 *
 * **Reduced motion is the caller's to honour**, by rendering `Blobatar`
 * instead, and the header above says why this file cannot read the setting
 * itself. React Native exposes it as
 * `AccessibilityInfo.useReduceMotionEnabled()` in an app that already imports
 * `react-native`, which makes the whole of it one ternary at the call site.
 * Swapping components mid-morph lands on the target pose immediately, which is
 * what the stylesheet's `transition: none` does under `prefers-reduced-motion`.
 *
 * There is no morph on mount. A blobatar eases out of idle only once a
 * consumer changes its expression, which is the web's rule too: transitions do
 * not run on an element's first style resolution, and a grid of avatars
 * animating themselves into existence on first paint is not what either
 * platform does.
 */
export function MorphingBlobatar(props: BlobatarProps) {
  return <Morphing {...split(props)} />;
}

/**
 * A blobatar with its idle layer running: breathe, bob, blink, glance, and the
 * tremor and seesaw two expressions carry. It morphs between expressions too,
 * so it is `MorphingBlobatar` with the ambient motion added rather than an
 * alternative to it.
 *
 * A third export rather than a prop, on the same measured grounds as the
 * second: the idle layer is the largest of the three tiers, and a prop on one
 * component is reachable from it whether or not anybody passes it. Three
 * components means an app pays for the tier it names.
 *
 * ## `animate` is the caller's, and that is the platform's doing
 *
 * On the web the idle layer is gated on `:hover`, which is both the aesthetic
 * answer and the performance one, and `animate="hover"` is the recommended
 * default for a grid. There is no hover on a touch screen. `motion.css` already
 * says so itself, under `@media not ((hover: hover) and (pointer: fine))`,
 * where it pauses every loop and forces amplitude to zero unless the blobatar
 * was marked `always`. So the only mode this platform has is the always one,
 * and the question of *when* becomes the app's rather than the library's.
 *
 * Which is the honest answer rather than a shortcut. Screen focus, list
 * viewability, a user preference, the OS reduced-motion setting: those are all
 * things an app knows and a component drawn into a scroll view does not.
 *
 * ```tsx
 * // a profile header, one large avatar
 * <AnimatedBlobatar name="ada" size={120} animate />
 *
 * // a grid: only what the list says is on screen
 * <AnimatedBlobatar name={u.id} size={44} animate={visible.has(u.id)} />
 *
 * // the OS setting, which this package cannot read itself
 * <AnimatedBlobatar name="ada" size={120} animate={!reduceMotion} />
 * ```
 *
 * It defaults to false, so an `AnimatedBlobatar` nobody has told to animate is
 * a still blobatar. Turning it on and off ramps the amplitude over 400ms rather
 * than switching it, which is `.mo-root`'s own transition: a blobatar that
 * begins breathing at full depth mid-breath reads as a fault.
 *
 * ## What runs it
 *
 * A `requestAnimationFrame` loop and a React render per frame, which is the
 * driver the morph already uses. Not Reanimated, and that was a decision with a
 * cost: worklets would run this on the UI thread, but a library has to ship
 * them pre-compiled, which means a Babel pass over a package built with Bun, a
 * peer dependency with a native build, and a copy of the composition inside the
 * worklet, since a worklet cannot call core's `idleTransforms`. That last one
 * is the thing ADR-0009 exists to prevent.
 *
 * The trade it leaves is real and worth knowing: every animating blobatar
 * re-renders sixty times a second on the JS thread. `animate` being the
 * caller's is what makes that affordable, because the app is the only thing
 * that knows how many need to be live at once.
 */