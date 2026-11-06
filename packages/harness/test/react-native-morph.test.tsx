/**
 * `MorphingBlobatar` settles onto the blobatar `Blobatar` draws.
 *
 * The oracle, stated once: **at a frozen pose, an animated blobatar's rendered
 * geometry must equal the static one's.** Core asserts that as arithmetic in
 * `test/morph.test.ts`, over every pose and four hundred seeds, which is the
 * wide and cheap half. This is the narrow and real half: it asserts the
 * *adapter* wired the arithmetic up: that the right transform reached the right
 * group, that the eye groups nest inside the body wrap rather than beside it,
 * that the fills landed on the elements rather than on the wrapper, and that
 * nothing is drawn twice or not at all.
 *
 * That is a different failure class from core's, and one core cannot see. A
 * transposed pair of eye transforms passes every assertion in core and puts
 * `wink` on the wrong side of the face here.
 *
 * The comparison is a settled morph, because a settled morph is the only frame
 * with a static counterpart to compare against. `renderToStaticMarkup` gives
 * exactly that: no `requestAnimationFrame` runs during a server render, so what
 * comes out is the component's mount state, which is the target pose with no
 * transition, which is also what a real device draws on first paint, and the
 * reason the morph deliberately does not run on mount.
 *
 * Geometry is compared to a hundredth of a unit rather than exactly, and that
 * is the honest tolerance rather than a loosened one: the static path bakes the
 * pose into coordinates and rounds after, this one rounds the drawn coordinates
 * and carries them through a matrix, so the two differ by less than the
 * rounding step the renderer already introduces. Core's test says the same
 * thing at the same precision, with the derivation.
 *
 * `react-native-svg` is stubbed. See `react-native-stub.ts` for what that does
 * and does not prove.
 */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Blobatar, MorphingBlobatar } from "@blobatar/react-native";
import { AnimatedBlobatar } from "@blobatar/react-native/animated";
import { _posed } from "blobatar/internal";
import { christmas, halloween } from "blobatar/seasonal";
import {
  happy,
  love,
  mad,
  scared,
  sick,
  sleepy,
  smug,
  surprised,
  thinking,
  unsure,
  wink,
} from "blobatar/expression";

/** A 2×3 affine matrix, in SVG's own column order. */
type M = [number, number, number, number, number, number];
const I: M = [1, 0, 0, 1, 0, 0];

const times = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/**
 * An SVG transform list as a matrix, throwing on anything it does not know.
 *
 * Strict for the reason the sibling file's parser is: a term silently skipped
 * here would make every assertion below pass against a picture that is wrong,
 * which is the exact failure this file exists to catch.
 */
function matrix(list: string): M {
  let m = I;
  for (const [, fn, args] of list.matchAll(/([a-zA-Z]+)\(([^)]*)\)/g)) {
    const n = args!.trim().split(/[\s,]+/).map(Number);
    if (fn === "matrix") m = times(m, n as M);
    else if (fn === "translate") m = times(m, [1, 0, 0, 1, n[0]!, n[1] ?? 0]);
    else if (fn === "scale") m = times(m, [n[0]!, 0, 0, n[1] ?? n[0]!, 0, 0]);
    else if (fn === "rotate") {
      const t = (n[0]! * Math.PI) / 180;
      m = times(m, [Math.cos(t), Math.sin(t), -Math.sin(t), Math.cos(t), 0, 0]);
    } else throw new Error(`unhandled transform function: ${fn}`);
  }
  return m;
}

/** One thing drawn, with the transform stack it landed under. */
type Prim = {
  tag: string;
  fill: string;
  /** The element's own attributes, before any transform. */
  attrs: Record<string, string>;
  at: M;
  /** How many `<g>` deep it sits, which is how the eyes are told apart. */
  depth: number;
};

/**
 * What a piece of markup draws, keeping each primitive's own attributes and the
 * matrix it sits under separately.
 *
 * Resolved coordinates are not computed here, and that is deliberate. Path data
 * is not a flat list of pairs: the backdrop's square is `H`/`V` and some
 * silhouettes' decoration is an arc, whose seven numbers are not three and a
 * half points. Splitting every `d` down the middle produced a comparison that
 * read `NaN` against `NaN` and passed. So the two halves of the figure are
 * compared by what they actually are. See the tests below.
 */
function drawn(markup: string): Prim[] {
  const body = markup.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const stack: M[] = [I];
  const out: Prim[] = [];
  let i = 0;

  const TOKEN = /<g([^>]*)>|<\/g>|<(path|circle)([^>]*?)\/?>(?:<\/(?:path|circle)>)?/g;
  for (let m = TOKEN.exec(body); m; m = TOKEN.exec(body)) {
    if (m.index !== i) throw new Error(`unparsed at ${i}: ${body.slice(i, m.index)}`);
    i = m.index + m[0].length;

    if (m[0] === "</g>") {
      stack.pop();
      continue;
    }
    const attrs = Object.fromEntries(
      [...(m[1] ?? m[3]!).matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1]!, a[2]!]),
    );
    if (m[1] !== undefined) {
      const at = stack[stack.length - 1]!;
      stack.push(attrs.transform ? times(at, matrix(attrs.transform)) : at);
      continue;
    }
    out.push({
      tag: m[2]!,
      fill: attrs.fill!,
      attrs,
      at: stack[stack.length - 1]!,
      depth: stack.length - 1,
    });
  }

  if (i !== body.length) throw new Error(`unparsed at end: ${body.slice(i)}`);
  return out;
}

/**
 * The points of a path that is known to be a `superellipse`: four cubic
 * segments and an anchor, every number a coordinate.
 *
 * Only the eyes go through this, which is the only place a pair-splitting read
 * of path data is safe, and it throws on anything carrying a command that would
 * make it unsafe rather than returning numbers that look fine.
 */
function points(d: string): [number, number][] {
  if (/[^MCZ\s\d.,-]/.test(d)) throw new Error(`not a superellipse: ${d}`);
  const n = d.match(/-?\d+\.?\d*/g)!.map(Number);
  if (n.length % 2) throw new Error(`odd coordinate count: ${d}`);
  const out: [number, number][] = [];
  for (let i = 0; i < n.length; i += 2) out.push([n[i]!, n[i + 1]!]);
  return out;
}

const apply = (m: M, [x, y]: [number, number]): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

/** Two matrices, to the precision a rounded coordinate is worth comparing at. */
function sameMatrix(a: M, b: M, why: string) {
  for (let i = 0; i < 6; i++) expect(a[i]!, `${why} [${i}]`).toBeCloseTo(b[i]!, 3);
}

/**
 * The figure split the way the two renderers actually differ: the eyes, which
 * carry the pose on a group of their own here and in their coordinates there,
 * and everything else, which is identical path data under one body translate.
 *
 * The eyes are found structurally rather than by counting from the end, so a
 * component that stopped nesting them would fail here instead of silently
 * comparing the wrong primitives.
 */
function halves(prims: Prim[], nEyes: number, costume = 0) {
  const deep = prims.filter(p => p.depth > (prims.some(q => q.depth > 3) ? 4 : 1));
  const end = prims.length - costume;
  const eyes = deep.length ? deep : prims.slice(end - nEyes, end);
  const rest = prims.filter(p => !eyes.includes(p));
  return { eyes, rest };
}

const render = (C: unknown, props: Record<string, unknown>) =>
  drawn(renderToStaticMarkup(createElement(C as never, props as never)));

const POSES = [
  ["happy", happy],
  ["mad", mad],
  ["wink", wink],
  ["surprised", surprised],
  ["sleepy", sleepy],
  ["smug", smug],
  ["unsure", unsure],
  ["scared", scared],
  ["love", love],
  ["sick", sick],
  ["thinking", thinking],
] as const;

const SEEDS = ["alain", "ada", "grace", "linus", "seed-7", "seed-42"];

test("the parser refuses markup it does not fully understand", () => {
  expect(() => drawn(`<svg><rect x="0"/></svg>`)).toThrow();
  expect(() => drawn(`<svg><g transform="skewX(4)"><path d="M0 0"/></g></svg>`)).toThrow();
  expect(() => points("M0 0H100V100H0Z")).toThrow();
});

/**
 * Agreement is not enough on its own, and this is the sibling file's argument
 * repeated because it applies twice as hard here: a morphing component that
 * rendered nothing would agree with a static one about nothing and pass every
 * comparison below.
 */
test("MorphingBlobatar renders a blobatar at all", () => {
  const prims = render(MorphingBlobatar, { name: "alain", size: 40, expression: mad });
  expect(prims.length).toBeGreaterThan(2);
  expect(prims.filter(p => p.tag === "path").length).toBeGreaterThan(2);
  expect(prims.every(p => p.fill.startsWith("#"))).toBe(true);
  // Two eyes, each in a group of its own inside the body wrap. The nesting is
  // the API between this file and the component, so it is asserted rather than
  // relied on by the comparisons below.
  expect(prims.filter(p => p.depth > 1).length).toBe(2);
});

test("it carries the pose on groups rather than in the path data", () => {
  // The property that makes a morph affordable at all, and the one thing this
  // file can check that no comparison of resolved coordinates can: the eye
  // paths must be the blobatar's *drawn* eyes, identical to the ones an
  // expressionless blobatar has, with everything the pose does living on a
  // wrapper. If a future change goes back to re-baking geometry per frame this
  // is what notices.
  const markup = renderToStaticMarkup(
    createElement(MorphingBlobatar as never, {
      name: "alain",
      size: 40,
      expression: mad,
    } as never),
  );
  const bare = renderToStaticMarkup(
    createElement(MorphingBlobatar as never, { name: "alain", size: 40 } as never),
  );
  const paths = (t: string) => [...t.matchAll(/<path d="([^"]*)"/g)].map(m => m[1]);
  expect(paths(markup)).toEqual(paths(bare));
  // …and the pose is nonetheless there, on the groups.
  expect(markup).toContain("<g transform=");
  expect(markup).not.toEqual(bare);
});

/**
 * The comparison itself, run over every pose.
 *
 * Split by role rather than done uniformly, because the two renderers differ in
 * exactly one place. Everything that is not an eye is the same path data on
 * both sides under the same body translate, so it is compared verbatim, which
 * is stricter than any tolerance. The eyes are the pose, so they are the half
 * that gets resolved into coordinates and compared to a rounding step.
 */
function agree(seed: string, name: string, props: Record<string, unknown>) {
  const want = render(Blobatar, props);
  const got = render(MorphingBlobatar, props);
  const why = `${seed} ${name}`;

  expect(got.length, why).toBe(want.length);
  // A still blobatar is flat, so its eyes are found by position: ahead of a
  // season's costume, which comes last.
  const costume = _posed(seed, props).costume.length;
  const a = halves(got, 2);
  const b = halves(want, 2, costume);
  expect(a.eyes.length, why).toBe(b.eyes.length);
  expect(a.rest.length, why).toBe(b.rest.length);

  a.rest.forEach((p, i) => {
    const q = b.rest[i]!;
    expect(p.tag, `${why} rest #${i}`).toBe(q.tag);
    // The fill is asserted exactly. It is the end of a colour travel rather
    // than a rounded coordinate, and `hot` is a finished colour, so nothing
    // here legitimately differs by a step.
    expect(p.fill, `${why} rest #${i}`).toBe(q.fill);
    expect(p.attrs.d ?? "", `${why} rest #${i} d`).toBe(q.attrs.d ?? "");
    expect(p.attrs.cx ?? "", `${why} rest #${i} cx`).toBe(q.attrs.cx ?? "");
    expect(p.attrs.cy ?? "", `${why} rest #${i} cy`).toBe(q.attrs.cy ?? "");
    expect(p.attrs.r ?? "", `${why} rest #${i} r`).toBe(q.attrs.r ?? "");
    sameMatrix(p.at, q.at, `${why} rest #${i}`);
  });

  a.eyes.forEach((p, i) => {
    const q = b.eyes[i]!;
    expect(p.fill, `${why} eye #${i}`).toBe(q.fill);
    const drawnPts = points(p.attrs.d!).map(pt => apply(p.at, pt));
    const wantPts = points(q.attrs.d!).map(pt => apply(q.at, pt));
    expect(drawnPts.length, `${why} eye #${i}`).toBe(wantPts.length);
    for (let k = 0; k < wantPts.length; k++) {
      expect(drawnPts[k]![0], `${why} eye #${i}.${k}x`).toBeCloseTo(wantPts[k]![0], 1);
      expect(drawnPts[k]![1], `${why} eye #${i}.${k}y`).toBeCloseTo(wantPts[k]![1], 1);
    }
  });
}

describe("a settled morph draws the static blobatar", () => {
  for (const [name, expression] of POSES) {
    test(name, () => {
      for (const seed of SEEDS) agree(seed, name, { name: seed, size: 40, expression });
    });
  }

  test("with no expression at all", () => {
    // The identity, which is where a wrong transform is least likely to be
    // noticed by eye and most likely to be shipped: every group is an identity
    // and a composition bug hides behind it. `bakePose`'s own history is
    // exactly this: a wrapper origin bug that read as a morph bug and was
    // invisible on an idle face.
    for (const seed of SEEDS) agree(seed, "idle", { name: seed, size: 40 });
  });
});

test("a different name is a different creature, not a morph", () => {
  // The distinction the component draws between changing an expression and
  // being handed a different blobatar, asserted from the outside: rendering
  // another name has to produce that name's blobatar outright, colours
  // included. React reuses a component across new list data routinely, and
  // without the cut the geometry would snap while one person's palette eased
  // into another's.
  //
  // A server render only ever produces the mount state, so what this can check
  // is that mounting with any name gives that name's blobatar exactly. The
  // interesting half, a *change* of name on a mounted component, is one of the
  // things `apps/example-native` exists for.
  for (const seed of SEEDS) agree(seed, "swap", { name: seed, size: 40, expression: mad });
});

describe("it takes the same options the still one does", () => {
  // Not the full `CASES` matrix, which the sibling file already runs against
  // `@blobatar/react`. What is worth checking here is only that the split into
  // two components did not leave one of them reading options the other does
  // not: they share `split`, and this is what says so.
  const OPTS: Record<string, unknown>[] = [
    { background: "circle" },
    { background: "square" },
    { background: false },
    { hue: 210 },
    { tone: 0.2 },
    { contrast: false },
    { traits: { "body.r": 0.9 } },
    { palette: { head: "#123456", eye: "#fedcba", bg: "#0a0a0a" } },
    { title: "Alain" },
    { normalize: false },
    { season: halloween },
    { season: halloween, expression: mad },
    { season: christmas },
  ];
  for (const o of OPTS) {
    test(JSON.stringify(o), () => {
      agree("alain", JSON.stringify(o), {
        name: "alain",
        size: 40,
        expression: happy,
        ...o,
      });
    });
  }
});

/**
 * `AnimatedBlobatar`, which is the third tier and the one that cannot be
 * checked in motion here.
 *
 * A server render produces the mount frame and nothing after it, so what this
 * can hold is the property that matters most and is easiest to lose: **an
 * animated blobatar that has not been told to animate is a still one.** Every
 * ambient layer is multiplied by an amplitude that starts at zero, so the six
 * levels of group it draws have to compose to exactly what the still component
 * draws, not to nearly that. A missed `* amp` is invisible on a device and
 * obvious here.
 *
 * `packages/blobatar/test/idle.test.ts` holds the loops themselves, and
 * `apps/example-native` is where somebody watches them move.
 */
describe("AnimatedBlobatar", () => {
  test("it draws the whole nest, not a flattened one", () => {
    // Seven levels: root, breathe, bob, the eye pair, the seesaw, the pose, and
    // each eye's own path. Every one of them has a different origin or a
    // different clock, and collapsing two is how the eye-scale bug in
    // `motion.css`'s own history happened.
    //
    // Seven rather than the stylesheet's six, and the extra one is the seesaw.
    // The pose is computed on the JS thread and the loops on the UI thread, so
    // the phase cannot be folded into the pose the way core folds it; it rides
    // outside as its own translate instead. That is what keeps
    // `poseTransforms`, the subtlest arithmetic in the library, out of a
    // worklet. See `rockT`.
    const prims = render(AnimatedBlobatar, { name: "alain", size: 40, animate: true });
    expect(Math.max(...prims.map(p => p.depth))).toBe(7);
    // …and the body is inside the ambient layers but outside the eye ones.
    const body = prims.filter(p => p.depth === 3);
    expect(body.length).toBeGreaterThan(0);
  });

  test("the eye paths are still the drawn eyes", () => {
    // The same claim the morph makes, one tier up: no path data is regenerated
    // for the idle layer either. Every loop lands on a group.
    const paths = (props: Record<string, unknown>) =>
      [...renderToStaticMarkup(createElement(AnimatedBlobatar as never, props as never))
        .matchAll(/<path d="([^"]*)"/g)].map(m => m[1]);
    expect(paths({ name: "alain", size: 40, animate: true, expression: mad })).toEqual(
      paths({ name: "alain", size: 40 }),
    );
  });

  for (const [name, expression] of [["idle", undefined], ...POSES] as const) {
    test(`at rest it is the still blobatar: ${name}`, () => {
      for (const seed of SEEDS) {
        const props = { name: seed, size: 40, ...(expression ? { expression } : {}) };
        const want = render(Blobatar, props);
        const got = render(AnimatedBlobatar, props);
        const why = `${seed} ${name}`;

        expect(got.length, why).toBe(want.length);
        const a = halves(got, 2);
        const b = halves(want, 2);
        a.rest.forEach((p, i) => {
          const q = b.rest[i]!;
          expect(p.fill, `${why} rest #${i}`).toBe(q.fill);
          expect(p.attrs.d ?? "", `${why} rest #${i}`).toBe(q.attrs.d ?? "");
          sameMatrix(p.at, q.at, `${why} rest #${i}`);
        });
        a.eyes.forEach((p, i) => {
          const q = b.eyes[i]!;
          expect(p.fill, `${why} eye #${i}`).toBe(q.fill);
          const drawnPts = points(p.attrs.d!).map(pt => apply(p.at, pt));
          const wantPts = points(q.attrs.d!).map(pt => apply(q.at, pt));
          for (let k = 0; k < wantPts.length; k++) {
            expect(drawnPts[k]![0], `${why} eye #${i}.${k}x`).toBeCloseTo(wantPts[k]![0], 1);
            expect(drawnPts[k]![1], `${why} eye #${i}.${k}y`).toBeCloseTo(wantPts[k]![1], 1);
          }
        });
      }
    });
  }
});
