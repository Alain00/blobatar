/**
 * A Blobatar style composed from silhouette definitions.
 *
 * The band table chooses and weights silhouettes. Each silhouette owns its
 * geometry and safe face region; this module owns the shared body, eyes and SVG
 * serialization. The seam is private, so it can deepen when a future shape
 * proves the current definition insufficient without committing consumers to
 * its lifecycle.
 */
import type { Palette } from "../color";
import { superellipse } from "../shape";
import type { Traits } from "../traits";
import type { Body, Deco, Ellipse, Shape } from "./shapes";

export interface Eye {
  cx: number; cy: number; rx: number; ry: number; n: number; rot: number;
}

export type Fit = (t: Traits, b: Body, face: Ellipse) => Eye[];

/** Fits the eye cluster against the silhouette's face region on both axes. */
export const faceFit: Fit = (t, b, face) => {
  const rx = b.rx;
  const er0 = t.num("eye.rx", 0.075, 0.105) * rx;
  const ratio = t.num("eye.ratio", 1.9, 3.2);
  const scale = t.num("eye.scale", 0.78, 1.24);
  const stretch = t.num("eye.stretch", 0.85, 1.18);
  const clearance = t.num("eye.gap", 0.1, 0.24) * rx;
  const wide = er0 * Math.max(1, scale);
  const tall = er0 * ratio * Math.max(1, scale * stretch);
  const gap0 = wide + rx * 0.03 + clearance;

  const gx = t.jitter("gaze.x", 0.09) * face.rx;
  const gy = t.num("gaze.y", -0.2, 0.08) * face.ry;
  const dy = t.jitter("eye.dy", 0.04) * face.ry;
  const reach = Math.hypot(wide, tall);
  const need = Math.hypot(
    (Math.abs(gx) + gap0 + reach) / face.rx,
    (Math.abs(gy) + Math.abs(dy) + reach) / face.ry,
  );
  const fit = need > 0.9 ? 0.9 / need : 1;

  const er = er0 * fit;
  const eyeRy = er * ratio;
  const gap = gap0 * fit;
  const room = Math.max(0, Math.min(1, clearance / tall));
  const bound = Math.min(12, (Math.asin(room) * 180) / Math.PI);
  const lean = t.num("eye.lean", -1, 1) * bound;
  const lean2 = Math.max(-12, Math.min(12, lean + t.jitter("eye.lean2", 3.5)));

  const cx = face.cx + gx * fit;
  const cy = face.cy + gy * fit;
  return [
    { cx: cx - gap, cy, rx: er, ry: eyeRy, n: t.num("eye.n", 3.5, 6), rot: lean },
    {
      cx: cx + gap, cy: cy + dy * fit,
      rx: er * scale, ry: eyeRy * scale * stretch,
      n: t.num("eye.n", 3.5, 6), rot: lean2,
    },
  ];
};

/** `[shape, upper edge of its band in [0, 1)]`, in order. */
export type Band = readonly [Shape, number];

export function compose(bands: Band[], fit: Fit) {
  const pick = (v: number) => (bands.find(([, upTo]) => v < upTo) ?? bands[bands.length - 1]!)[0];

  function layout(t: Traits) {
    const shape = pick(t("shape"));
    const r = t.num("body.r", 31, 38) * shape.core;
    const body: Body = {
      cx: 50 + t.jitter("body.x", 1.5),
      cy: 50 + t.jitter("body.y", 1.5),
      rx: r,
      ry: r * t.num("body.ratio", 0.92, 1.08),
      n: t.num("body.n", 1.9, 2.5),
      rot: 0,
      radii: Array.from({ length: t.int("body.pts", 6, 8) }, (_, i) => 1 + t.jitter(`body.r${i}`, 0.16)),
    };
    shape.body?.(t, body);

    // The body itself when the shape names no face, which is what a silhouette
    // convex around its own centre wants — and it already carries the four
    // fields a face is.
    const face = shape.face?.(body) ?? body;
    const deco: Deco = { petals: [], extra: [] };
    shape.decorate?.(t, body, deco);

    return {
      shape: shape.name,
      draw: shape.path,
      body, face,
      petals: deco.petals,
      extra: deco.extra,
      eyes: fit(t, body, face),
    };
  }

  /**
   * `costume` is a season's marks, already serialized. It goes inside the
   * motion groups so it moves with the head, and after the eyes, none of which
   * it covers. Its wrapper is in the head colour; see `motion.css` for why.
   */
  function render(l: ReturnType<typeof layout>, p: Palette, mo?: boolean, costume?: string): string {
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const eye = (e: Eye, i: number) => {
      const path = `<path d="${superellipse(e)}"/>`;
      return mo
        ? `<g class="mo-eye" style="--mo-wrap:${i ? 1 : -1};--mo-lean:${r2(e.rot)};transform-origin:${r2(e.cx)}px ${r2(e.cy)}px">${path}</g>`
        : path;
    };
    const body =
      `<g fill="${p.head}">` +
      l.petals.map(d => `<circle cx="${r2(d.cx)}" cy="${r2(d.cy)}" r="${r2(d.r)}"/>`).join("") +
      l.extra.map(d => `<path d="${d}"/>`).join("") +
      `<path d="${l.draw ? l.draw(l.body) : superellipse(l.body)}"/>` +
      `</g>` +
      `<g fill="${p.eye}"${mo ? ` class="mo-eyes"` : ""}>` +
      l.eyes.map(eye).join("") +
      `</g>` +
      (costume ? `<g fill="${p.head}">${costume}</g>` : "");
    return mo ? `<g class="mo-breathe"><g class="mo-bob">${body}</g></g>` : body;
  }

  return { layout, render, background: false as const };
}

/**
 * One drawn primitive, as data rather than as markup.
 *
 * This is the other half of `render`, and it exists because `react-native-svg`
 * has no `innerHTML` to hand a string to, so an adapter there builds real
 * elements or it builds nothing. Serializing here and parsing there would put
 * an XML parser between the renderer and the screen, which is a place output
 * can change, and ADR-0009 is explicit that an adapter adds no geometry of its
 * own.
 *
 * The fill rides on every mark rather than on a group. `render` groups by fill
 * because SVG attribute inheritance makes that cheaper on the wire; nothing
 * downstream of this reads a group, so grouping here would only be structure
 * the adapter has to walk back out.
 */
export type Mark =
  | { kind: "path"; d: string; fill: string }
  | { kind: "circle"; cx: number; cy: number; r: number; fill: string };

/**
 * The same figure `render` draws, as marks.
 *
 * **A standalone function, deliberately not a method on the object `compose`
 * returns.** A property of a live object literal can never be dropped by a
 * bundler, so putting it there would charge every web consumer for a seam only
 * React Native reads. That is the same reasoning that keeps `animate.ts` out of static
 * bundles by passing the motion factory in rather than importing it.
 *
 * Kept beside `render` rather than derived from it, or it from this. Both
 * directions were available and both tax the static path everyone is already
 * on: an emitter puts an indirection in it, and making marks primary makes it
 * allocate an array of objects before stringifying. So there are two small
 * traversals of one layout, and the drift that invites is *caught* rather than
 * prevented: `test/marks.test.ts` asserts these serialize to exactly what
 * `render` emits, over the golden corpus, and `packages/harness` compares the
 * React Native adapter against React on every case in its table.
 *
 * No `mo` parameter. React Native never animates (the motion layer is CSS), so
 * there is no motion grouping to emit and no class to carry.
 */
export function marks(l: Layout, p: Palette): Mark[] {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const head = p.head!;
  return [
    ...l.petals.map((d): Mark => ({ kind: "circle", cx: r2(d.cx), cy: r2(d.cy), r: r2(d.r), fill: head })),
    ...l.extra.map((d): Mark => ({ kind: "path", d, fill: head })),
    { kind: "path", d: l.draw ? l.draw(l.body) : superellipse(l.body), fill: head },
    ...l.eyes.map((e): Mark => ({ kind: "path", d: superellipse(e), fill: p.eye! })),
  ];
}

/**
 * What a composed `layout` returns.
 *
 * `shape` is a `string` here rather than a union of names, because which names
 * are possible is a property of the band table and not of the composer. The
 * public `blob` entry narrows this to the package major's known vocabulary.
 */
export type Layout = ReturnType<ReturnType<typeof compose>["layout"]>;
