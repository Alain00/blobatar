/**
 * Seasons — `blobatar/seasonal`.
 *
 * A season dresses a blobatar for a date: at Halloween it is a pumpkin or a
 * ghost, at Christmas it wears a Santa hat and, for half the roster, a beard.
 * The eyes underneath are the name's own, so a user is still recognisable in
 * costume.
 *
 * **A season is passed in, never read off the clock by the library.** Two
 * promises rule that out: the same name renders the same markup within a
 * major (`test/golden/gen2.txt` enforces it), and the endpoint serves pinned
 * URLs as immutable for a year. A `blobatar()` that consulted `Date` would
 * break both on the morning of October 24th. So the calendar is `seasonNow()`
 * below, a plain function the consumer calls — and the one place in this
 * package that reads a date:
 *
 * ```ts
 * import { blobatar } from "blobatar";
 * import { seasonNow } from "blobatar/seasonal";
 *
 * blobatar(user.email, { season: seasonNow() }); // undefined outside a season
 * ```
 *
 * **Each season is a value, for the reason each expression is** (ADR-0002).
 * `blobatar()` calls through whatever object it is handed and imports nothing
 * from here, so a consumer who imports `halloween` ships a pumpkin and a ghost
 * and one who imports nothing ships nothing. The exports are plain object
 * literals over shared function references rather than calls to a factory —
 * a top-level call is not provably side-effect-free and would keep every
 * season alive whether or not it was imported.
 *
 * What a season may do is bounded by three seams:
 *
 * - **`traits`**: pin or narrow traits, exactly as a caller's `traits` option
 *   does and under it — a caller's own pin still wins. Halloween narrows the
 *   silhouette to the four that read as a pumpkin or a sheet; the body stays
 *   derived, never set, which keeps the rule in `CONTEXT.md` intact.
 * - **`wear`**: pin the hue and the tone the palette is built from, so the
 *   contrast guarantee is kept by construction rather than re-proven — a
 *   pumpkin is the ordinary ramp at an orange hue, and the eye floor still
 *   runs over it. A season's colour wins over `hue`/`tone` but is worked out
 *   from them: a pumpkin is orange whatever the brand hue, and a ghost is a
 *   pastel of it. An explicit `palette` still wins over the season, because
 *   that option bypasses every guarantee by contract.
 * - **`dress`**: marks drawn after the eyes, each carrying its own fill, and a
 *   transform around the whole figure so a hat has room above the head inside
 *   the same 100×100 frame. The backdrop stays outside it.
 *
 * Nothing here adds an id, a `<defs>` or a gradient, so every promise the
 * README makes about the markup holds in costume.
 */

import { fadeHex, type Palette } from "./color";
import { superellipse } from "./shape";
import { marks as figure, type Layout, type Mark } from "./styles/compose";
import type { TraitOverrides, Traits } from "./traits";

/** A season: what it pins, and what it draws. */
export interface Season {
  /** Stable id, for an endpoint or a CLI to name the season by. */
  readonly id: string;
  /** Trait pins and narrowings applied under the caller's own `traits`. */
  readonly traits?: TraitOverrides;
  /**
   * The hue and tone the palette is built from, when the costume has a colour,
   * given the hue the plain render would use.
   */
  readonly wear?: (t: Traits, hue: number) => { hue?: number; tone?: number };
  /**
   * The costume, off the resting layout and palette: its marks, the same marks
   * as markup, and its fit composed with the pose's own wrap into the one
   * `transform` the figure's `<g>` takes.
   */
  readonly dress?: (
    l: Layout,
    p: Palette,
    t: Traits,
    pose: string,
  ) => { marks: Mark[]; markup: string; wrap: string };
}

// ---------------------------------------------------------------------------
// Shared helpers. Plain function declarations, so an unused season's share of
// them tree-shakes with it.

const r2 = (v: number) => {
  const s = Math.round(v * 100) / 100;
  return Object.is(s, -0) ? 0 : s;
};

/**
 * Marks as markup, grouped by fill the way `render` groups the body and the
 * eyes — `<g fill>` runs rather than a `fill` on every mark, because that is
 * what `test/marks.test.ts`'s tokenizer already reads and because attribute
 * inheritance is cheaper on the wire.
 *
 * Marks in the `head` colour get no run of their own: they inherit it from the
 * wrapper `render` puts around the costume, so they tint with the body when
 * animated (see `motion.css`).
 */
function paint(marks: Mark[], head: string): string {
  let out = "";
  let fill = head;
  for (const m of marks) {
    if (m.fill !== fill) {
      out += (fill !== head ? "</g>" : "") + ((fill = m.fill) !== head ? `<g fill="${fill}">` : "");
    }
    out +=
      m.kind === "circle"
        ? `<circle cx="${m.cx}" cy="${m.cy}" r="${m.r}"/>`
        : `<path d="${m.d}"/>`;
  }
  return fill !== head ? out + "</g>" : out;
}

/** The furthest a pose moves the body, up (`happy`) or down (`sad`). */
const LIFT = 2.6;

/**
 * The transform that keeps a costumed figure inside the frame: `""` when it
 * already fits, else the least change that brings it inside `[1, 99]`:
 * shrunk about the centre only as far as its height or width demands, then
 * moved the shortest way in, so a short head is nudged rather than shrunk.
 *
 * The body is measured with the costume, because the figure may move, and
 * every height is padded by `LIFT`: the pose runs *inside* this transform, so
 * a hat fitted flush to the top would be lifted out of the frame by
 * `happy`.
 */
function frame(costume: Mark[], l: Layout): string {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const m of [...figure(l, {}), ...costume]) {
    if (m.kind === "circle") xs.push(m.cx - m.r, m.cx + m.r), ys.push(m.cy - m.r - LIFT, m.cy + m.r + LIFT);
    else m.d.match(/-?[\d.]+/g)!.forEach((v, i) => (i % 2 ? ys.push(+v - LIFT, +v + LIFT) : xs.push(+v)));
  }
  const lo = (v: number[]) => Math.min(...v);
  const hi = (v: number[]) => Math.max(...v);
  const k = Math.min(1, Math.floor(Math.min(98 / (hi(xs) - lo(xs)), 98 / (hi(ys) - lo(ys))) * 100) / 100);
  const e = (v: number[]) => r2(Math.min(99 - k * hi(v), Math.max(1 - k * lo(v), (1 - k) * 50)));
  const x = e(xs);
  const y = e(ys);
  return k < 1 || x || y ? `matrix(${k} 0 0 ${k} ${x} ${y})` : "";
}

/** `Season.dress`, given the season's marks. */
function dress(
  costume: (l: Layout, p: Palette, t: Traits) => Mark[],
  l: Layout,
  p: Palette,
  t: Traits,
  pose: string,
) {
  const marks = costume(l, p, t);
  const fit = frame(marks, l);
  return { marks, markup: paint(marks, p.head!), wrap: fit && pose ? `${fit} ${pose}` : fit || pose };
}

const circle = (cx: number, cy: number, r: number, fill: string): Mark => ({
  kind: "circle", cx: r2(cx), cy: r2(cy), r: r2(r), fill,
});
const path = (d: string, fill: string): Mark => ({ kind: "path", d, fill });

/**
 * A scalloped run from `(x0, y)` to `(x1, y)`, one quadratic per bump with its
 * control `s` off the line (below for a positive `s`). A quadratic only
 * reaches half of its control's offset, so a bump shows `s / 2`; the
 * containment test checks the control points, which bound the curve.
 */
function scallops(x0: number, x1: number, y: number, s: number, count: number): string {
  let d = "";
  const w = (x1 - x0) / count;
  for (let i = 0; i < count; i++) {
    const a = x0 + w * i;
    d += `Q${r2(a + w / 2)} ${r2(y + s)} ${r2(a + w)} ${r2(y)}`;
  }
  return d;
}

/**
 * Where the body's outline crosses `y`, outermost on side `s`, sampled off its
 * path so a sheet starts flush with a lumpy body.
 */
function edge(l: Layout, y: number, s: number) {
  const v = (l.draw ? l.draw(l.body) : superellipse(l.body)).match(/-?[\d.]+/g)!.map(Number);
  let x = l.body.cx + s * l.body.rx * 0.96;
  let best = -1e9;
  let [px, py] = v as [number, number];
  for (let i = 2; i + 5 < v.length; i += 6)
    for (let k = 0.05; k < 1.01; k += 0.05) {
      const c = (j: number) =>
        (1 - k) ** 3 * v[i + j - 2]! + 3 * (1 - k) ** 2 * k * v[i + j]! + 3 * (1 - k) * k * k * v[i + j + 2]! + k ** 3 * v[i + j + 4]!;
      const qx = c(0);
      const qy = c(1);
      if ((py - y) * (qy - y) <= 0 && py !== qy) {
        const cx = px + ((qx - px) * (y - py)) / (qy - py);
        if (s * cx > best) best = s * (x = cx);
      }
      px = qx;
      py = qy;
    }
  return x;
}

/** The lower edge of the lower eye: nothing under the eyes may start above it. */
const eyesBottom = (l: Layout) => Math.max(...l.eyes.map(e => e.cy + e.ry));

/**
 * Off-white for fur, pom-poms and sheets' edges, and the grey that every
 * light piece is laid over a little lower, so its edge holds on a pale head
 * and on a white page.
 */
const WHITE = "#f7f7f7";
const SHADE = "#c4c6d0";

// ---------------------------------------------------------------------------
// Halloween. Per seed, a pumpkin or a ghost. The pick is a trait, so one name
// has one Halloween look and a caller can pin it with
// `traits: { "season.pick": 0.9 }` like any other trait.

const STEM = "#4f7f2e";
const LEAF = "#7fae4a";

/** The seed's own hue, before any `hue` option. */
const hue = (t: Traits) => t.num("hue", 0, 360);

/**
 * Which look a seed gets. A cloud is always a ghost: it is the best sheet and
 * the worst pumpkin, a head with ears. Otherwise the threshold follows the
 * seed's own hue, so a warm blobatar is usually a pumpkin and a cool one
 * usually a ghost, and the costume keeps the colour a teammate is known by.
 * Over the roster it is still about half and half, and a pin of `season.pick`
 * at 0.1 or 0.9 decides it outright for every silhouette but the cloud.
 */
const pumpkin = (t: Traits) =>
  t("shape") < 0.7 && t("season.pick") < 0.55 + 0.3 * Math.cos(((hue(t) - 55) * Math.PI) / 180);

/**
 * The pumpkin is the deep tone, always: the mid swatch is a peach that a
 * plain orange blob already wears, and the pale and ink ones lose the colour.
 * Its hue is the blobatar's usual one held into orange, red folding to 40 and
 * yellow and beyond to 60, so pumpkins differ the way their wearers do. The
 * ghost is the pastel at that hue, the pale swatch furthest off white, except
 * that khaki and olive (80–130) move out to apricot or mint: a pastel there
 * reads as slime rather than as a sheet.
 */
function halloweenWear(t: Traits, h: number) {
  return pumpkin(t)
    ? { hue: Math.min(60, Math.max(40, ((h + 125) % 360) - 125)), tone: 0.7 }
    : { hue: h > 80 && h < 130 ? (h < 105 ? 70 : 150) : h, tone: 0.1 };
}

function halloweenMarks(l: Layout, p: Palette, t: Traits): Mark[] {
  const b = l.body;
  const lean = t.jitter("season.lean", 1);
  if (pumpkin(t)) {
    // A stem leaning the way the seed says, buried into the crown so the join
    // never shows on a lumpy silhouette, and a leaf on the side it leans from.
    const top = b.cy - b.ry * 0.95;
    const side = lean < 0 ? 1 : -1;
    // `palette` may set any CSS colour and `fadeHex` reads only `#rrggbb`, so
    // anything else gets ribs in the head colour, which is to say none.
    const rib = /^(#[\da-f]{6}){2}$/i.test(p.head! + p.eye!) ? fadeHex(p.head!, p.eye!, 0.2) : p.head!;
    const out = [
      path(superellipse({ cx: b.cx, cy: top - 2.5, rx: 4.2, ry: 7, n: 3, rot: lean * 16 }), STEM),
      path(superellipse({ cx: b.cx + side * 6.5, cy: top - 3, rx: 5, ry: 2.4, n: 2, rot: side * -24 }), LEAF),
    ];
    // Two ribs, ( and ), in the body colour a step toward the eyes, so they
    // follow whatever colour the pumpkin is. They bow out with the outline and
    // lean in at the ends, stay outside both eye boxes, and are left off on a
    // side where the eyes sit too wide for one to fit before the rim.
    for (const s of [-1, 1]) {
      const dx = Math.max(b.rx * 0.55, ...l.eyes.map(e => s * (e.cx - b.cx) + e.rx * 1.8 + 2.5 + b.rx * 0.1));
      if (dx > b.rx * 0.8) continue;
      const x = b.cx + s * dx;
      const h = b.ry * 0.88 * Math.sqrt(1 - (dx / b.rx) ** 2);
      const end = x - s * b.rx * 0.1;
      const bow = x + s * b.rx * 0.2;
      out.push(
        path(
          `M${r2(end)} ${r2(b.cy - h)}Q${r2(bow + s * 2)} ${r2(b.cy)} ${r2(end)} ${r2(b.cy + h)}` +
            `Q${r2(bow - s * 5)} ${r2(b.cy)} ${r2(end)} ${r2(b.cy - h)}Z`,
          rib,
        ),
      );
    }
    return out;
  }
  // A sheet: the lower body re-drawn in the head colour, flaring a little and
  // swaying the way the seed leans, with a hem of three bumps that hangs past
  // the body's own edge. That silhouette is the ghost, and the frame makes
  // room for it. It starts under the lower eye, never over one: the sheet is
  // the head colour, and an eye it crossed would simply lose its bottom. Laid
  // over a grey copy like the fur, so the hem holds on a white page.
  const low = eyesBottom(l);
  const y0 = Math.max(b.cy + b.ry * 0.3, low + 6);
  const hem = b.cy + b.ry;
  const s = Math.max(5, b.ry * 0.16);
  const sway = lean * b.rx * 0.1;
  const w0 = b.rx * 0.96;
  const w1 = b.rx * 1.05;
  const arm = b.rx * 0.14;
  const r = Math.max(2.6, l.eyes[0]!.rx * 1.1);
  const xl = edge(l, y0, -1);
  const xr = edge(l, y0, 1);
  const sheet = (dy: number, fill: string) =>
    path(
      `M${r2(xl)} ${r2(y0 + dy)}Q${r2(Math.min(xl, b.cx - w0))} ${r2(hem + dy - 4)} ${r2(b.cx - w1 + sway)} ${r2(hem + dy)}` +
        scallops(b.cx - w1 + sway, b.cx + w1 + sway, hem + dy, s * 2, 3) +
        `Q${r2(Math.max(xr, b.cx + w0))} ${r2(hem + dy - 4)} ${r2(xr)} ${r2(y0 + dy)}Z`,
      fill,
    );
  return [
    sheet(1.5, SHADE),
    sheet(0, p.head!),
    // Little arms, low enough not to read as bolts on a box, and an open
    // "boo" between the eyes: the one cue that still tells a ghost from a
    // pale blob at 20 px.
    circle(xl, y0 + arm * 1.6, arm, p.head!),
    circle(xr, y0 + arm * 1.6, arm, p.head!),
    circle(l.eyes.reduce((x, e) => x + e.cx, 0) / l.eyes.length, low + 2 + r, r, p.eye!),
  ];
}

export const halloween: Season = {
  id: "halloween",
  // The four silhouettes that read as a pumpkin or a sheet: round, organic,
  // boxy and cloud. Band midpoints, as a narrowing; see `TraitOverrides`. The
  // body stands nearly upright, so a pumpkin's ribs and a ghost's hem are not
  // drawn level across a tilted one.
  traits: { shape: [0.11, 0.35, 0.54, 0.825], "body.rot": [0.4, 0.5, 0.6] },
  wear: halloweenWear,
  dress: (l, p, t, pose) => dress(halloweenMarks, l, p, t, pose),
};

// ---------------------------------------------------------------------------
// Christmas. A Santa hat for everybody and a beard for half the roster.

const RED = "#c8102e";

function christmasMarks(l: Layout, p: Palette, t: Traits): Mark[] {
  const b = l.body;
  const dir = t("season.lean") < 0.5 ? -1 : 1;
  const eyeTop = Math.min(...l.eyes.map(e => e.cy - e.ry));
  const half = b.rx * 0.84;
  // Tilted toward the flop and with the head, and pulled down onto the
  // forehead as far as the eyes allow, so it sits on the head rather than on
  // top of it like a lid.
  const tilt = dir * 7 + b.rot * 0.6;
  const rad = (tilt * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const by = Math.min(b.cy - b.ry * (b.n > 3 ? 0.9 : 0.8), eyeTop - 5 - (half + 2.5) * Math.abs(sin));
  // Hat-local points, `dx` toward the flop and `dy` up when negative, tilted
  // about the brim's centre.
  const X = (dx: number, dy: number) => b.cx + dx * dir * cos - dy * sin;
  const Y = (dx: number, dy: number) => by + dx * dir * sin + dy * cos;
  const P = (dx: number, dy: number) => `${r2(X(dx, dy))} ${r2(Y(dx, dy))}`;
  const H = 22;
  const tx = half * 1.02;
  const ty = -H * 0.55;
  const brim = (dy: number, fill: string) =>
    path(superellipse({ cx: b.cx, cy: by + dy, rx: half + 2.5, ry: 4.2, n: 3, rot: tilt }), fill);
  const out: Mark[] = [
    // The cone, drawn first so the brim covers its base: it rises past the
    // centre, peaks, and flops over to hold its pom-pom clear of the brim.
    path(
      `M${P(-half * 0.9, 1)}Q${P(-half * 0.55, -H * 1.1)} ${P(half * 0.15, -H)}` +
        `Q${P(half * 0.85, -H)} ${P(tx, ty)}Q${P(half * 0.5, -H * 0.8)} ${P(half * 0.62, 1)}Z`,
      RED,
    ),
    brim(1.2, SHADE),
    brim(0, WHITE),
    circle(X(tx, ty), Y(tx, ty) + 1.2, 5.2, SHADE),
    circle(X(tx, ty), Y(tx, ty), 5.2, WHITE),
  ];
  if (t.bool("season.beard")) {
    // A beard, not a bib. Its top is a moustache, two bumps rising under the
    // resting eyes; it leaves the cheeks in the body colour and tapers to
    // three lobes that hang just past the chin.
    const y0 = eyesBottom(l) + 4.5;
    const yb = b.cy + b.ry;
    const w = b.rx * 0.82;
    const beard = (dy: number, fill: string) =>
      path(
        `M${r2(b.cx - w)} ${r2(y0 + 4)}` +
          scallops(b.cx - w, b.cx + w, y0 + 4, -8, 2) +
          `Q${r2(b.cx + w)} ${r2(yb + dy - 6)} ${r2(b.cx + w * 0.6)} ${r2(yb + dy)}` +
          scallops(b.cx + w * 0.6, b.cx - w * 0.6, yb + dy, 7, 3) +
          `Q${r2(b.cx - w)} ${r2(yb + dy - 6)} ${r2(b.cx - w)} ${r2(y0 + 4)}Z`,
        fill,
      );
    out.push(beard(1.5, SHADE), beard(0, WHITE));
  }
  return out;
}

export const christmas: Season = {
  id: "christmas",
  dress: (l, p, t, pose) => dress(christmasMarks, l, p, t, pose),
};

// ---------------------------------------------------------------------------
// The calendar.

/** Every season, in calendar order. For a picker, a CLI or an endpoint. */
export const SEASONS: readonly Season[] = [halloween, christmas];

/**
 * `[season, from, to]` as `MMDD`, inclusive at both ends, in the caller's local
 * time. A window that crossed New Year would need a second rule; none does.
 */
const WINDOWS: [Season, number, number][] = [
  [halloween, 1024, 1101],
  [christmas, 1210, 1226],
];

/**
 * The season active on `date`, or `undefined` for none, which `blobatar()`
 * reads as no costume. Local time, because a costume is for the person looking
 * at it.
 */
export function seasonNow(date = new Date()): Season | undefined {
  const at = (date.getMonth() + 1) * 100 + date.getDate();
  return WINDOWS.find(([, from, to]) => at >= from && at <= to)?.[0];
}
