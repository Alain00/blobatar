/**
 * `@blobatar/preact` — the Preact adapter.
 *
 * Written in JSX and compiled against `preact/jsx-runtime`, which is what
 * `tsconfig.json`'s `jsxImportSource` selects and `scripts/build.ts` keeps
 * external. That is the build isolation ADR-0009 split the packages for: core's
 * single `Bun.build` could not hold Preact's runtime beside React's transform,
 * and the attempt that tried gave up and returned a raw DOM node from a
 * function component — which Preact drops silently for an empty string, with a
 * clean typecheck and a green suite.
 *
 * `packages/harness` renders this package with `preact-render-to-string` for
 * exactly that reason. An adapter is only known to work when something has
 * watched it produce markup.
 */

import { useMemo } from "preact/hooks";
import type { JSX } from "preact";
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
  /** Present so the union can be destructured; ignored without `animate`. */
  travel?: undefined;
} & Omit<Omit<JSX.HTMLAttributes<HTMLImageElement>, "src">, "travel">;

type AnimatedProps = {
  animate: Animate;
  /** Whole-figure directional travel; requires `blobatar/motion.css`. */
  travel?: Travel;
} & Omit<
  JSX.SVGAttributes<SVGSVGElement>,
  "children" | "dangerouslySetInnerHTML"
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

export function Blobatar({
  name: seed,
  size,
  background,
  palette,
  hue,
  tone,
  normalize,
  contrast,
  title,
  animate,
  travel,
  expression,
  traits,
  ...rest
}: BlobatarProps) {
  // Pulled out explicitly like every other option, because what is left in
  // `rest` goes straight onto the DOM element — a `traits` object spread onto
  // an `<img>` is a malformed attribute per blobatar.
  const opts = {
    size,
    background,
    palette,
    hue,
    tone,
    normalize,
    contrast,
    title,
    expression,
    traits,
  };

  // Both branches are hooks-stable: `animate` changing swaps the element type,
  // which remounts anyway.
  const dep = JSON.stringify([seed, opts, animate, travel]);

  const src = useMemo(() => (animate ? "" : blobatarUri(seed, opts)), [dep]);

  const parts = useMemo(
    () => (animate ? _parts(seed, { ...opts, animate, travel }) : null),
    [dep],
  );

  /**
   * The markup object, kept stable by identity and not just by value.
   *
   * Preact diffs `dangerouslySetInnerHTML` by comparing `__html` against the
   * previous vnode's, so a fresh `{__html}` literal carrying the same string is
   * cheap here in a way it is not in React. Memoized anyway, and deliberately:
   * the two adapters are read side by side, the cost is one comparison, and the
   * reason the root `<g>` is a real element rather than part of this string is
   * the same in both — see below.
   */
  const html = useMemo(() => ({ __html: parts?.inner ?? "" }), [parts?.inner]);

  if (parts) {
    const { style, ...svgRest } = rest as JSX.SVGAttributes<SVGSVGElement>;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        width={size}
        height={size}
        // With a `title` the markup carries a `<title>`, so this is a labelled
        // image; without one it is decoration and should be skipped entirely —
        // the same call `alt=""` makes on the `<img>` path. Never both: a
        // `role="img"` that is also `aria-hidden` just contradicts itself.
        role={title ? "img" : undefined}
        aria-hidden={title ? undefined : true}
        style={{
          ...(parts.vars as JSX.CSSProperties),
          ...(style as JSX.CSSProperties),
        }}
        {...svgRest}
      >
        {/*
          Three real children rather than one innerHTML blob, and the reason is
          the morph. Only the third varies at runtime — its class does, when the
          expression changes — and `dangerouslySetInnerHTML` is all-or-nothing:
          had the root `<g>` stayed inside that string, every expression change
          would replace the entire subtree. A fresh element has no previous
          computed value, so no transition runs on it and every idle animation
          under it restarts from phase zero.

          The first two have to be siblings of the root rather than inside it:
          `<title>` names the element it is the first child of, so nesting it
          would label a `<g>` instead of this `<svg>`, and the backdrop must sit
          outside the hover-lift or the plate scales with the creature.
        */}
        {title ? <title>{title}</title> : null}
        {parts.bg ? <path d={parts.bg.d} fill={parts.bg.fill} /> : null}
        <g class={parts.cls} dangerouslySetInnerHTML={html} />
      </svg>
    );
  }

  const { alt, ...imgRest } = rest as JSX.HTMLAttributes<HTMLImageElement> & {
    alt?: string;
  };
  return (
    <img src={src} width={size} height={size} alt={alt ?? title ?? ""} {...imgRest} />
  );
}
