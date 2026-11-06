/**
 * `AnimatedBlobatar`, on its own entry point.
 *
 * `@blobatar/react-native/animated` rather than the package root, because this
 * is the only part of the adapter that touches `react-native-reanimated`. That
 * is a native module with a build step on the far side of the bridge, and a
 * root import of it would make every consumer install and link it, including
 * the ones drawing a still avatar in a list. Behind a subpath the peer
 * dependency is optional in fact and not merely in the manifest.
 *
 * The worklets this drives are compiled at publish time. See the Babel step in
 * `scripts/build.ts` for why a library has to do that itself.
 */

import { useEffect, useMemo, useRef, type ComponentType, type ReactNode } from "react";
import { poseTransforms, _posed, type BlobatarOptions, type Pose } from "blobatar/internal";
import { idleSeeds, type IdleFrame } from "blobatar/idle";
import Reanimated, {
  Easing,
  useAnimatedProps,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { G, Path, type GProps, type SvgProps } from "react-native-svg";
import { Body, Costume, Frame, split, useMorph, type BlobatarProps } from "./parts";
import { bobT, breatheT, eyesT, glanceT, idleFrame, rockT, rootT, type Mat } from "./worklets";

/**
 * A `<G>` whose transform can be written from the UI thread.
 *
 * Created once at module scope, as `createAnimatedComponent` requires: called
 * inside a component it would produce a new type every render, and React would
 * unmount and remount the whole subtree sixty times a second.
 *
 * The cast widens the props by the one prop the loops write. `matrix` is a real
 * prop of the native `RNSVGGroup` and the only transform it has, but it is
 * absent from `GProps`, which describes what a *consumer* passes to `<G>`:
 * there, `transform` is the prop, and `react-native-svg` turns it into `matrix`
 * in JavaScript on its way down. A worklet skips that JavaScript, so it has to
 * write the lower prop, and saying so here is more honest than an `as never` at
 * each of the six call sites.
 */
const AG = Reanimated.createAnimatedComponent(
  G as unknown as ComponentType<GProps & { matrix?: Mat }>,
);

function Animated({
  seed,
  size,
  title,
  opts,
  on,
  rest,
}: {
  seed: string;
  size: number;
  title?: string;
  opts: Omit<BlobatarOptions, "animate" | "size">;
  on: boolean;
  rest: SvgProps;
}) {
  const dep = JSON.stringify([seed, opts]);
  const figure = useMemo(
    () => _posed(seed, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dep],
  );
  const seeds = useMemo(
    () => idleSeeds(seed, { normalize: opts.normalize, traits: opts.traits }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, JSON.stringify(opts.traits ?? null), opts.normalize],
  );
  const { shown, step, token } = useMorph(figure, seed, opts);

  // The morph still needs a clock, and it is the only thing here that does.
  const first = useRef(true);
  useEffect(() => {
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

  // The clock, written once per frame on the UI thread and read by everything
  // below it. `timeSinceFirstFrame` rather than a wall clock, which is fine
  // because every loop is phase-offset per seed and none of them has an origin
  // that means anything.
  const clock = useSharedValue(0);
  useFrameCallback(f => {
    "worklet";
    clock.value = f.timeSinceFirstFrame;
  }, true);

  // Amplitude ramps rather than switching, which is `.mo-root`'s own
  // `transition: --mo-amp 400ms ease-out`. A blobatar that starts breathing at
  // full depth mid-breath reads as a fault rather than as something waking up.
  const amp = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    amp.value = withTiming(on ? 1 : 0, {
      duration: 400,
      easing: Easing.bezier(0, 0, 0.58, 1),
    });
  }, [on, amp]);

  // The two pose channels the loops read. Mirrored into shared values because
  // the loops live on the other thread and a pose is JS state.
  const shake = useSharedValue(shown.pose.shake);
  const rock = useSharedValue(shown.pose.rock);
  const edy2 = useSharedValue(shown.pose.edy2);
  shake.value = shown.pose.shake;
  rock.value = shown.pose.rock;
  edy2.value = shown.pose.edy2;

  // Every loop, once per frame. Each `useAnimatedProps` below reads this rather
  // than evaluating its own, so the whole idle layer costs one pass.
  const frame = useDerivedValue(() =>
    // The tremor is scaled by amplitude here and *not* in core, which is a
    // deliberate difference from the stylesheet rather than an oversight.
    //
    // `shake` is a pose channel, so `motion.css` runs `mo-shake` regardless of
    // `--mo-amp`: a `mad` blobatar on the web trembles whether or not anything
    // is hovering it, and on touch the loop is merely *paused*, at a keyframe
    // whose offset is not zero. Ported literally that makes
    // `animate={false}` draw a `mad` blobatar about a tenth of a unit off from
    // the still one, which breaks the promise this component's own prop makes
    // and which `packages/harness` caught the moment it was asserted.
    //
    // So the tremor fades with everything else. At full amplitude it is exactly
    // what the stylesheet does; at zero the blobatar is exactly what `Blobatar`
    // draws; in between it ramps rather than snapping. Core keeps the faithful
    // model, because core is describing the stylesheet.
    idleFrame(seeds, clock.value, amp.value, shake.value * amp.value),
  );

  // `matrix` and not `transform`, which is the difference between this file
  // animating and this file rendering one frame and stopping. See the note at
  // the top of `worklets.ts`.
  const rootP = useAnimatedProps(() => ({ matrix: rootT(frame.value) }));
  const breatheP = useAnimatedProps(() => ({ matrix: breatheT(frame.value) }));
  const bdy = shown.pose.bdy;
  const bobP = useAnimatedProps(() => ({ matrix: bobT(frame.value, bdy) }));
  const eyesP = useAnimatedProps(() => ({ matrix: eyesT(frame.value) }));

  const t = poseTransforms({ eyes: figure.eyeFrames }, shown.pose);

  return (
    <Frame size={size} title={title} rest={rest}>
      {/* Outside every layer of the motion, matching every other renderer: a
          plate that breathes and bobs with the creature stops being a plate. */}
      {figure.bg ? <Path d={figure.bg.d} fill={figure.bg.fill} /> : null}
      <AG animatedProps={rootP}>
        {/*
          The season's fit, outside the breathe and the bob as on the web; a
          group only when there is one.
        */}
        <Fit transform={figure.fit}>
          <AG animatedProps={breatheP}>
            {/*
              The one animated group that carries a static `transform` as well,
              and the reason is the seam between the two threads. React owns the
              props on render and the UI thread owns them between renders, so a
              re-render (which the morph does on every frame of its 300ms) drops
              each group back to what React last said. For every other group that
              is the identity, which is exactly what the still renderer draws, so
              the worst case is one frame of a motionless blobatar. The bob is
              different: its matrix also carries the pose's own lift, and
              forgetting that for a frame would drop the body rather than merely
              stop it. So the still lift is passed the way `Blobatar` passes it,
              as a string React parses, and the loop writes over it.
            */}
            <AG animatedProps={bobP} transform={`translate(0 ${bdy})`}>
              <Body marks={figure.marks} fill={shown.fill.head} />
              <AG animatedProps={eyesP}>
                {figure.eyes.map((m, i) => (
                  <Eye
                    key={i}
                    d={m.d}
                    fill={shown.fill.eye}
                    pose={t.eyes[i]!}
                    frame={frame}
                    rock={rock}
                    edy2={edy2}
                    at={figure.eyeFrames[i]!}
                    side={i ? 1 : -1}
                  />
                ))}
              </AG>
              <Costume marks={figure.costume} from={figure.fill.head} to={shown.fill.head} />
            </AG>
          </AG>
        </Fit>
      </AG>
    </Frame>
  );
}

/** `children` under a static transform when there is one, bare otherwise. */
const Fit = ({ transform, children }: { transform: string; children: ReactNode }) =>
  transform ? <G transform={transform}>{children}</G> : <>{children}</>;

/**
 * One eye, and the three levels it needs.
 *
 * A component of its own because `useAnimatedProps` is a hook and there are two
 * eyes: called in a loop in the parent it would break the rules of hooks the
 * first time somebody drew a blobatar with a different number of them.
 *
 * The middle level is the seesaw and the inner one is the blink and the
 * glance's foreshortening. The pose sits between them as a plain string,
 * computed on the JS thread, for the reason the parent gives.
 */
function Eye({
  d,
  fill,
  pose,
  frame,
  rock,
  edy2,
  at,
  side,
}: {
  d: string;
  fill: string;
  pose: string;
  frame: { value: IdleFrame };
  rock: { value: number };
  edy2: { value: number };
  at: { cx: number; cy: number; rot: number };
  side: number;
}) {
  const rockP = useAnimatedProps(() => ({
    matrix: rockT(
      frame.value,
      { edy2: edy2.value, rock: rock.value } as Pose,
      side,
    ),
  }));
  const glanceP = useAnimatedProps(() => ({
    matrix: glanceT(frame.value, at.cx, at.cy, at.rot, side),
  }));
  return (
    <AG animatedProps={rockP}>
      <G transform={pose}>
        <AG animatedProps={glanceP}>
          <Path d={d} fill={fill} />
        </AG>
      </G>
    </AG>
  );
}

/**
 * Everything that is not an eye, which is one fill and no motion of its own.
 *
 * Shared by the two animated bodies, where the fill is a value that travels.
 * The still one keeps its own copy deliberately: it is the row the size gate
 * holds at its pre-morph number, and an indirection it does not need is exactly
 * what that row exists to notice.
 */
export function AnimatedBlobatar({
  animate = false,
  ...props
}: BlobatarProps & { animate?: boolean }) {
  return <Animated {...split(props as BlobatarProps)} on={animate} />;
}
