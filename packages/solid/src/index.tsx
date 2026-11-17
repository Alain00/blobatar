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

import { Show, createMemo, splitProps, type JSX } from "solid-js";
import { _parts, type Animate, type BlobatarOptions } from "blobatar/internal";
import { blobatarUri } from "blobatar/uri";

/**
 * Two rendering modes, and the props follow the mode — the same union core's
 * React component declares, for the same reason. `onLoad` should stop
 * type-checking the moment animation is on, because it stops firing.
 */
type StaticProps = { animate?: false } & Omit<
  JSX.ImgHTMLAttributes<HTMLImageElement>,
  "src"
>;

type AnimatedProps = { animate: Animate } & Omit<
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
} & BlobatarOptions &
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
  "backgroundColor",
  "palette",
  "defs",
  "paint",
  "hue",
  "tone",
  "normalize",
  "contrast",
  "title",
  "animate",
  "expression",
  "traits",
] as const;

export function Blobatar(props: BlobatarProps) {
  const [own, rest] = splitProps(props as BlobatarProps & Record<string, unknown>, OPTIONS);

  const opts = createMemo<BlobatarOptions>(() => ({
    size: own.size,
    background: own.background,
    backgroundColor: own.backgroundColor,
    palette: own.palette,
    defs: own.defs,
    paint: own.paint,
    hue: own.hue,
    tone: own.tone,
    normalize: own.normalize,
    contrast: own.contrast,
    title: own.title,
    expression: own.expression,
    traits: own.traits,
  }));

  const parts = createMemo(() =>
    own.animate ? _parts(own.name, { ...opts(), animate: own.animate }) : null,
  );

  const src = createMemo(() => (own.animate ? "" : blobatarUri(own.name, opts())));

  /*
   * `<Show>` rather than the ternary this used to be, and the difference is not
   * style — it is whether the `<svg>` survives a prop change.
   *
   * Solid wraps a dynamic child expression in one computation, so a branch
   * written as `parts() ? <svg…> : <img…>` re-runs whenever *anything* it reads
   * changes: a new `name`, a new `hue`, a new size. Re-running it builds a new
   * element and swaps it in, which is the failure the comment inside is about,
   * one level up — a fresh `<svg>` has no previous computed value either, so
   * every idle animation under it restarts from phase zero and any driver
   * holding the old element is left pointing at a detached node. It is the
   * only adapter that did this; React, Preact, Vue and Svelte all keep the
   * element and update its attributes.
   *
   * A non-keyed `<Show>` memoizes on the *condition* rather than on the value,
   * so the branch is built once and stays while `parts()` keeps returning
   * something. Everything inside it is an ordinary reactive attribute, updated
   * in place, which is what the other four have always done.
   *
   * Caught by `the excursion survives a prop change` in
   * `packages/harness/scripts/probe-gaze.ts`, which reports the swap in so many
   * words.
   */
  const [carriedStyle, svgRest] = splitProps(rest, ["style"]);
  const [carriedAlt, imgRest] = splitProps(rest, ["alt"]);

  return (
    <Show
      when={parts()}
      fallback={
        <img
          src={src()}
          width={own.size}
          height={own.size}
          alt={(carriedAlt.alt as string | undefined) ?? own.title ?? ""}
          {...(imgRest as JSX.ImgHTMLAttributes<HTMLImageElement>)}
        />
      }
    >
      {(p) => (
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
            ...(p().vars as JSX.CSSProperties),
            ...(carriedStyle.style as JSX.CSSProperties),
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
          <Show when={own.title}>{(t) => <title>{t()}</title>}</Show>
          <Show when={p().bg}>{(bg) => <path d={bg().d} fill={bg().fill} />}</Show>
          <g class={p().cls} innerHTML={p().inner} />
        </svg>
      )}
    </Show>
  );
}
