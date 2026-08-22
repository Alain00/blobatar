/**
 * `@blobatar/solid` — the Solid adapter.
 *
 * Written in Solid JSX and compiled by `babel-preset-solid`, which is the
 * thing ADR-0009 split the packages to make possible. An earlier attempt at
 * three adapters as subpaths of core could not hold five mutually
 * incompatible JSX transforms in one `Bun.build` call, gave up, and hand-rolled
 * `document.createElementNS` instead — shipping a Preact adapter that rendered
 * an empty string. Build isolation is what this package spends its existence
 * on; `scripts/build.ts` is where it collects it.
 *
 * So: no DOM construction here. Anything written against `document` renders
 * nowhere there is no `document`, which is every SSR consumer and the harness
 * row that would have caught the empty string.
 */

import { createMemo, splitProps, type JSX } from "solid-js";
import {
  _parts,
  type Animate,
  type BlobatarOptions,
  type Travel,
} from "blobatar/internal";
import { blobatarUri } from "blobatar/uri";

/**
 * Two rendering modes, and the props follow the mode — the same union core's
 * React component declares, for the same reason. `onLoad` should stop
 * type-checking the moment animation is on, because it stops firing.
 */
type StaticProps = {
  animate?: false;
} & Omit<Omit<JSX.ImgHTMLAttributes<HTMLImageElement>, "src">, "travel">;

type AnimatedProps = {
  animate: Animate;
  /** Whole-figure directional travel; requires `blobatar/motion.css`. */
  travel?: Travel;
} & Omit<
  JSX.SvgSVGAttributes<SVGSVGElement>,
  "children" | "innerHTML" | "viewBox"
>;

export type BlobatarProps = {
  /**
   * Who the blobatar is for. A username, a display name, an email, a bot's
   * handle, a user id — any string, and the same string always renders the
   * same blobatar. The only required prop.
   */
  name: string;
} & Omit<BlobatarOptions, "travel"> &
  (StaticProps | AnimatedProps);

/**
 * Split by name rather than destructured, and this is not stylistic.
 *
 * Destructuring a Solid component's props reads every one of them once, at
 * setup, and drops the getters that make them reactive — a blobatar written
 * that way renders the first `name` it is given and then never changes again.
 * `splitProps` is the same separation done without the read.
 *
 * The list is also what keeps options off the DOM: whatever is left in `rest`
 * is spread onto the element, and a `traits` object on an `<img>` is a
 * malformed attribute per blobatar.
 */
const OPTIONS = [
  "name",
  "size",
  "background",
  "palette",
  "hue",
  "tone",
  "normalize",
  "contrast",
  "title",
  "animate",
  "travel",
  "expression",
  "traits",
] as const;

export function Blobatar(props: BlobatarProps) {
  const [own, rest] = splitProps(props as BlobatarProps & Record<string, unknown>, OPTIONS);

  const opts = createMemo<BlobatarOptions>(() => ({
    size: own.size,
    background: own.background,
    palette: own.palette,
    hue: own.hue,
    tone: own.tone,
    normalize: own.normalize,
    contrast: own.contrast,
    title: own.title,
    expression: own.expression,
    traits: own.traits,
  }));

  const parts = createMemo(() =>
    own.animate
      ? _parts(own.name, {
          ...opts(),
          animate: own.animate,
          // `splitProps` types the extra key as `unknown` through the
          // `Record<string, unknown>` arm of the cast above.
          travel: own.travel as Travel | undefined,
        })
      : null,
  );

  const src = createMemo(() => (own.animate ? "" : blobatarUri(own.name, opts())));

  return (
    <>
      {(() => {
        const p = parts();
        if (p) {
          const [carried, svgRest] = splitProps(rest, ["style"]);
          return (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 100 100"
              width={own.size}
              height={own.size}
              // With a `title` the markup carries a `<title>`, so this is a
              // labelled image; without one it is decoration and should be
              // skipped entirely — the same call `alt=""` makes on the `<img>`
              // path. Never both.
              role={own.title ? "img" : undefined}
              aria-hidden={own.title ? undefined : true}
              style={{
                ...(p.vars as JSX.CSSProperties),
                ...(carried.style as JSX.CSSProperties),
              }}
              {...(svgRest as JSX.SvgSVGAttributes<SVGSVGElement>)}
            >
              {/*
                Three real children rather than one `innerHTML` blob, and the
                reason is the morph. Only the third varies at runtime — its
                class does, when the expression changes — and setting
                `innerHTML` is all-or-nothing: had the root `<g>` stayed inside
                that string, every expression change would replace the whole
                subtree, and a fresh element has no previous computed value, so
                no transition runs on it and every idle animation under it
                restarts from phase zero.

                The first two are siblings of the root rather than inside it:
                `<title>` names the element it is the first child of, and the
                backdrop must sit outside the hover-lift or the plate scales
                with the creature.
              */}
              {own.title ? <title>{own.title}</title> : null}
              {p.bg ? <path d={p.bg.d} fill={p.bg.fill} /> : null}
              <g class={p.cls} innerHTML={p.inner} />
            </svg>
          );
        }

        const [carried, imgRest] = splitProps(rest, ["alt"]);
        return (
          <img
            src={src()}
            width={own.size}
            height={own.size}
            alt={(carried.alt as string | undefined) ?? own.title ?? ""}
            {...(imgRest as JSX.ImgHTMLAttributes<HTMLImageElement>)}
          />
        );
      })()}
    </>
  );
}
