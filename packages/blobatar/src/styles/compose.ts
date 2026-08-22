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

  function render(l: ReturnType<typeof layout>, p: Palette, mo?: boolean): string {
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const eye = (e: Eye, i: number) => {
      const path = `<path d="${superellipse(e)}"/>`;
      return mo
        ? `<g class="mo-eye" style="--mo-wrap:${i ? 1 : -1};--mo-lean:${r2(e.rot)};transform-origin:${r2(e.cx)}px ${r2(e.cy)}px">${path}</g>`
        : path;
    };
    const b = l.body;
    const f = l.face;
    const shadow =
      `<ellipse cx="${r2(b.cx)}" cy="${r2(Math.min(97, b.cy + b.ry + b.rx * 0.06))}" rx="${r2(b.rx * 0.72)}" ry="${r2(b.rx * 0.13)}" fill="${p.eye}" opacity="0.14"/>`;
    const sheen =
      `<ellipse class="mo-sheen" cx="${r2(f.cx - f.rx * 0.25)}" cy="${r2(f.cy - f.ry * 0.45)}" rx="${r2(f.rx * 0.28)}" ry="${r2(f.ry * 0.18)}" fill="${p.bg}" opacity="0.35"/>`;
    const bodyCore =
      l.petals.map(d => `<circle cx="${r2(d.cx)}" cy="${r2(d.cy)}" r="${r2(d.r)}"/>`).join("") +
      l.extra.map(d => `<path d="${d}"/>`).join("") +
      `<path d="${l.draw ? l.draw(l.body) : superellipse(l.body)}"/>`;
    const body =
      `<g fill="${p.head}">` +
      bodyCore +
      // Sheen UNDER the eyes: later siblings paint on top, and a milky wash
      // across the eyes reads as a cataract — probe check H catches exactly
      // that, because its elementFromPoint sampling sees the sheen instead of
      // the eye wherever they overlap.
      (mo ? sheen : "") +
      `</g>` +
      `<g fill="${p.eye}"${mo ? ` class="mo-eyes"` : ""}>` +
      l.eyes.map(eye).join("") +
      `</g>`;
    if (!mo) return body;
    // The animated half adds three things the static path never draws, all of
    // them plain palette-derived geometry — no gradients (a per-seed radial
    // gradient needs an id, and this library emits none), no filters (they
    // repaint on the main thread every frame of a traverse):
    //
    // - A ground shadow, OUTSIDE breathe/bob but inside travel. Grounded is the
    //   point: the creature bobs over a shadow that stays put, which is most of
    //   the depth read for one ellipse.
    // - A sheen, INSIDE bob, pinned to the upper face so it rides with the
    //   body — and under the eyes; see the note at its emission above.
    // - The travel wrapper itself, which owns `translate`/`rotate` for whole-
    //   figure motion — properties nothing else claims on any element (the
    //   hover lift has `transform` on the root, bob `transform` here, saccade
    //   and tremor `translate` elsewhere).
    return `<g class="mo-travel">${shadow}<g class="mo-breathe"><g class="mo-bob">${body}</g></g></g>`;
  }

  return { layout, render, background: false as const };
}

/**
 * What a composed `layout` returns.
 *
 * `shape` is a `string` here rather than a union of names, because which names
 * are possible is a property of the band table and not of the composer. The
 * public `blob` entry narrows this to the package major's known vocabulary.
 */
export type Layout = ReturnType<ReturnType<typeof compose>["layout"]>;
