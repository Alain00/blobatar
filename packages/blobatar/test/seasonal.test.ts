/**
 * Seasons: a costume is deterministic, bounded, legible and free when absent.
 *
 * The golden fixture already freezes what each seasonal render *is*; this file
 * is about the properties a costume has to keep whatever it looks like — the
 * same four the body keeps — plus the one thing the module does that the
 * renderer must not, which is read a date.
 */

import { describe, expect, test } from "bun:test";
import { _layout, _marks, _posed, blobatar } from "../src/blobatar";
import { contrast, fromHex } from "../src/color";
import * as E from "../src/expression";
import { SEASONS, christmas, halloween, seasonNow } from "../src/seasonal";

const SEEDS = Array.from({ length: 400 }, (_, i) => `season-${i}`);

/** Every coordinate pair a path's data names, including control points. */
const points = (d: string): [number, number][] => {
  const nums = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i]!, nums[i + 1]!]);
  return out;
};

/** A list of `matrix(…)` and `translate(…)`, applied to a point right to left. */
const apply = (transform: string, p: [number, number]): [number, number] =>
  [...transform.matchAll(/(matrix|translate)\(([^)]*)\)/g)].reduceRight(([x, y], [, fn, args]) => {
    const v = args!.split(/[\s,]+/).map(Number);
    const [a, b, c, d, e, f] = fn === "matrix" ? v : [1, 0, 0, 1, v[0], v[1] ?? 0];
    return [a! * x + c! * y + e!, b! * x + d! * y + f!];
  }, p);

describe("the calendar", () => {
  test("is the only thing that reads a date, and takes it as an argument", () => {
    expect(seasonNow(new Date(2026, 9, 31))).toBe(halloween);
    expect(seasonNow(new Date(2026, 9, 24))).toBe(halloween);
    expect(seasonNow(new Date(2026, 10, 1))).toBe(halloween);
    expect(seasonNow(new Date(2026, 9, 23))).toBeUndefined();
    expect(seasonNow(new Date(2026, 10, 2))).toBeUndefined();
    expect(seasonNow(new Date(2026, 11, 10))).toBe(christmas);
    expect(seasonNow(new Date(2026, 11, 25))).toBe(christmas);
    expect(seasonNow(new Date(2026, 11, 26))).toBe(christmas);
    expect(seasonNow(new Date(2026, 11, 27))).toBeUndefined();
    expect(seasonNow(new Date(2026, 5, 15))).toBeUndefined();
  });

  test("lists every season once, with a stable id", () => {
    expect(SEASONS.map(s => s.id)).toEqual(["halloween", "christmas"]);
  });

  test("`undefined` is no costume at all", () => {
    for (const s of SEEDS.slice(0, 20)) {
      expect(blobatar(s, { season: undefined })).toBe(blobatar(s));
    }
  });
});

describe("a costume", () => {
  test("is deterministic: the same name in the same season renders the same markup", () => {
    for (const season of SEASONS) {
      for (const s of SEEDS.slice(0, 50)) {
        expect(blobatar(s, { season })).toBe(blobatar(s, { season }));
      }
    }
  });

  test("emits no ids and stays small enough to inline", () => {
    for (const season of SEASONS) {
      const sizes = SEEDS.map(s => {
        const svg = blobatar(s, { season, expression: E.mad });
        expect(svg).not.toContain("id=");
        expect(svg).not.toContain("NaN");
        expect(svg).not.toContain("undefined");
        return svg.length;
      });
      expect(Math.max(...sizes)).toBeLessThan(2600);
    }
  });

  test("keeps the eye floor: a costume's colours go through the ramp", () => {
    // Halloween pins the hue and the tone the palette is built *from*, so the
    // contrast chain still runs over them. Asserted against every seed rather
    // than trusted, because that is the whole reason `wear` returns inputs to
    // the ramp rather than finished colours.
    for (const s of SEEDS) {
      const { palette } = _layout(s, { season: halloween });
      expect(contrast(fromHex(palette.head!), fromHex(palette.eye!))).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("stays inside the frame, fit and all, in every pose", () => {
    // The pose runs inside the fit, so a hat fitted flush to the top with no
    // pose could be lifted out of the frame by one. Every expression, then.
    const poses = [undefined, ...Object.values(E).filter((e): e is E.Expression => typeof e === "object" && "bake" in e)];
    for (const season of SEASONS) {
      for (const [i, s] of SEEDS.entries()) {
        const f = _marks(s, { season, expression: poses[i % poses.length] });
        for (const m of f.marks) {
          const pts: [number, number][] =
            m.kind === "circle"
              ? [[m.cx - m.r, m.cy - m.r], [m.cx + m.r, m.cy + m.r]]
              : points(m.d);
          for (const p of pts) {
            const [x, y] = apply(f.transform, p);
            expect(x, `${season.id} ${s}`).toBeGreaterThanOrEqual(0);
            expect(x, `${season.id} ${s}`).toBeLessThanOrEqual(100);
            expect(y, `${season.id} ${s}`).toBeGreaterThanOrEqual(0);
            expect(y, `${season.id} ${s}`).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });

  test("never covers an eye", () => {
    // Every costume mark's bounding box is checked against both eyes' boxes:
    // a hat is above them, a beard and a sheet below, a stem on the crown.
    for (const season of SEASONS) {
      for (const s of SEEDS) {
        const l = _layout(s, { season });
        const eyes = l.eyes.map(e => ({
          x0: e.cx - e.rx * 1.2, x1: e.cx + e.rx * 1.2, y0: e.cy - e.ry, y1: e.cy + e.ry,
        }));
        for (const m of l.costume) {
          const pts: [number, number][] =
            m.kind === "circle"
              ? [[m.cx - m.r, m.cy - m.r], [m.cx + m.r, m.cy + m.r]]
              : points(m.d);
          const xs = pts.map(p => p[0]);
          const ys = pts.map(p => p[1]);
          const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
          for (const e of eyes) {
            const overlaps = box.x0 < e.x1 && box.x1 > e.x0 && box.y0 < e.y1 && box.y1 > e.y0;
            expect(overlaps, `${season.id} ${s}`).toBe(false);
          }
        }
      }
    }
  });

  test("is the tail of `_marks`, and comes back separately from `_posed`", () => {
    for (const season of SEASONS) {
      for (const s of SEEDS.slice(0, 40)) {
        const all = _marks(s, { season });
        const f = _posed(s, { season });
        expect(f.costume.length).toBeGreaterThan(0);
        expect([...f.marks, ...f.eyes, ...f.costume]).toEqual(all.marks);
        expect(f.fit).toBe(all.transform);
      }
    }
  });

  test("comes off the resting face, so a pose moves the eyes and not the beard", () => {
    const opts = { season: christmas, traits: { "season.beard": 0.1 } };
    for (const s of SEEDS.slice(0, 40)) {
      const still = _posed(s, opts);
      const posed = _posed(s, { ...opts, expression: E.happy });
      expect(posed.costume).toEqual(still.costume);
      // And the pose's own wrap composes after the season's fit, in one string.
      const m = _marks(s, { ...opts, expression: E.happy });
      expect(m.transform.startsWith(still.fit)).toBe(true);
      expect(m.transform.length).toBeGreaterThan(still.fit.length);
    }
  });

  test("can be pinned like any trait, and the caller's pin wins over the season's", () => {
    // `season.pick` selects the Halloween look; `shape` is narrowed by the
    // season and a caller may narrow it further.
    // A cloud is always a ghost, so the pin is over a pinned round body.
    for (const s of SEEDS.slice(0, 40)) {
      const pumpkin = _layout(s, { season: halloween, traits: { shape: 0.11, "season.pick": 0.1 } });
      const ghost = _layout(s, { season: halloween, traits: { shape: 0.11, "season.pick": 0.9 } });
      expect(pumpkin.costume[0]!.fill).toBe("#4f7f2e");
      expect(ghost.costume[1]!.fill).toBe(ghost.palette.head!);
      expect(_layout(s, { season: halloween, traits: { shape: 0.11 } }).shape).toBe("round");
    }
  });

  test("keeps a pumpkin orange and a ghost in `hue`, and loses to `palette`", () => {
    const pumpkin = { season: halloween, traits: { shape: 0.11, "season.pick": 0.1 } };
    const ghost = { season: halloween, traits: { shape: 0.11, "season.pick": 0.9 } };
    // Blue holds at the yellow end of orange, 60.
    expect(_layout("alain", { ...pumpkin, hue: 210 }).palette.head).toBe(
      _layout("alain", { ...pumpkin, hue: 60 }).palette.head,
    );
    expect(_layout("alain", { ...ghost, hue: 210 }).palette.head).toBe(
      _layout("alain", { hue: 210, tone: 0.1 }).palette.head,
    );
    const overridden = _layout("alain", {
      season: halloween, traits: { "season.pick": 0.1 }, palette: { head: "#123456" },
    }).palette;
    expect(overridden.head).toBe("#123456");
  });

  test("draws with any CSS colour `palette` sets", () => {
    for (const head of ["#f80", "orange", "rgb(255 128 0)"]) {
      const opts = { season: halloween, traits: { shape: 0.11, "season.pick": 0.1 }, palette: { head } };
      expect(blobatar("alain", opts)).not.toContain("NaN");
    }
  });
});
