/**
 * Reference-vector exporter for generation-2 ports.
 *
 * Runs the generation-2 TypeScript implementation at a pinned release and
 * writes the cross-language fixture the Dart and Swift packages check against.
 * The source of truth is the tree at `BLOBATAR_TS_SRC` (default: a v2.4.0
 * checkout). Motion uses `BLOBATAR_MOTION_SRC` because the pure TypeScript
 * evaluator was extracted from that release's stylesheet. Neither source is a
 * port's generated output. The fixture's `meta` object and package READMEs
 * document the schema and comparison rules.
 *
 *   BLOBATAR_TS_SRC=/tmp/blobatar-v240/packages/blobatar/src \
 *     BLOBATAR_MOTION_SRC=packages/blobatar/src \
 *     bun tools/export-reference-vectors.ts
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC =
  process.env.BLOBATAR_TS_SRC ?? "/tmp/blobatar-v240/packages/blobatar/src";
const MOTION_SRC =
  process.env.BLOBATAR_MOTION_SRC ??
  resolve(import.meta.dir, "../packages/blobatar/src");

const { normalizeSeed, seedState, stream } = await import(`${SRC}/hash.ts`);
const { traits } = await import(`${SRC}/traits.ts`);
const { ramp, toHex } = await import(`${SRC}/color.ts`);
const { _layout } = await import(`${SRC}/blobatar.ts`);
const { superellipse } = await import(`${SRC}/shape.ts`);
const expressionModule = await import(`${SRC}/expression.ts`);
const { idleAt, idleSeeds } = await import(`${MOTION_SRC}/idle.ts`);
const { lerpPose } = await import(`${MOTION_SRC}/morph.ts`);
const { MORPH_IN, MORPH_OUT } = await import(`${MOTION_SRC}/ease.ts`);
const { fadeHex } = await import(`${MOTION_SRC}/color.ts`);

const OUT = process.env.BLOBATAR_VECTORS_OUT ?? "fixtures/blobatar-v2.4.0.json";

/** The trait keys gen-2's layout reads, hand-written like test/keys.ts. */
const KEYS = [
  "shape",
  "hue",
  "tone",
  "body.r",
  "body.ratio",
  "body.x",
  "body.y",
  "body.n",
  "body.rot",
  "body.pts",
  ...Array.from({ length: 8 }, (_, i) => `body.r${i}`),
  "gaze.x",
  "gaze.y",
  "eye.rx",
  "eye.ratio",
  "eye.scale",
  "eye.stretch",
  "eye.gap",
  "eye.n",
  "eye.dy",
  "eye.lean",
  "eye.lean2",
  "capsule.squat",
  "nub.n",
  "nub.a0",
  "nub.r0",
  "nub.a1",
  "nub.r1",
  "cloud.n",
  "cloud.r0",
  "droplet.tip",
  "poly.round",
  "sun.n",
  "sun.dist",
  "sun.r",
  "sun.rot",
];

const HASH_SEEDS = [
  "",
  " ",
  "a",
  "alain",
  "Alain",
  "  ALAIN@Example.COM  ",
  "café",
  "cafe\u0301",
  "日本語",
  "Ελλάδα",
  "🦊",
  "🦋",
  "🦊🐻",
  "أحمد",
  "🇫🇷",
  "a\uFEFFb",
  "İ",
  "ß",
  "Straße",
  "STRAẞE",
  "ünïcødé",
  "\t\nmixed case\r\n",
  "0",
  "00000000-0000-4000-8000-000000000000",
  // Final_Sigma: word-initial/isolated sigmas stay σ; word-final become ς.
  "Σ",
  " Σ ",
  "Σ\u0301",
  "ΣΣ",
  "ΟΣ",
  "ΟΣΔ",
  "ΑΣ",
];

const HUES = [0, 45, 90, 137.5, 210, 300, 359, 360];
const TONES = [
  0, 0.1, 0.2, 0.35, 0.36, 0.5, 0.61, 0.62, 0.79, 0.8, 0.92, 0.93, 0.999, 1,
];

/** Overrides that pin each silhouette band, for deterministic shape coverage. */
const SHAPE_PINS: [string, number][] = [
  ["round", 0],
  ["organic", 0.3],
  ["boxy", 0.5],
  ["capsule", 0.65],
  ["nub", 0.75],
  ["cloud", 0.82],
  ["droplet", 0.88],
  ["hexagon", 0.93],
  ["sun", 0.96],
  ["triangle", 0.99],
];

const OVERRIDE_CASES: [string, Record<string, number | number[]>][] = [
  ["alain", { "eye.gap": 0.82 }],
  ["alain", { "eye.rx": 0 }],
  ["alain", { a: 0, b: 0.5, c: 0.999999 }],
  ["alain", { high: 1, way: 99, low: -3 }],
  ["alain", { shape: 0.95, "eye.ratio": 0 }],
  ["alain", { shape: [0.11, 0.965] }],
  ["alain", { shape: [] }],
  ["alain", { "eye.gap": [0.3, 0.9] }],
  ["user-7", { "body.r": 1, "eye.rx": 0.999999 }],
];

const EXPRESSION_NAMES = [
  "idle",
  "happy",
  "sad",
  "mad",
  "surprised",
  "wink",
  "sleepy",
  "smug",
  "unsure",
  "scared",
  "love",
  "shy",
  "sick",
  "thinking",
] as const;

const EXPRESSION_CASES = [
  { seed: "expression-round", options: { traits: { shape: 0.1 } } },
  { seed: "expression-organic", options: { traits: { shape: 0.35 } } },
  { seed: "expression-triangle", options: { traits: { shape: 0.99 } } },
];

const MOTION_CASES = [
  { seed: "alain", options: {} },
  { seed: "Ada Lovelace", options: {} },
  { seed: "  MIXED Case  ", options: { normalize: false } },
  {
    seed: "motion-overrides",
    options: {
      traits: {
        "motion.phase": 0.125,
        "motion.bob": 0.875,
        "motion.blink": 0.25,
        "motion.blinkPhase": 0.75,
        "motion.saccade": 0.625,
        "motion.saccadePhase": 0.375,
        "motion.lookX": 0.5,
        "motion.lookY": 0.25,
        "motion.lookXFlip": 0.75,
        "motion.lookYFlip": 0.25,
      },
    },
  },
];

const MOTION_SAMPLES = [
  { elapsedMilliseconds: 0, amplitude: 0, shake: 0 },
  { elapsedMilliseconds: 0, amplitude: 1, shake: 0.55 },
  { elapsedMilliseconds: 112, amplitude: 0.4, shake: 0.35 },
  { elapsedMilliseconds: 1234, amplitude: 1, shake: 0.55 },
  { elapsedMilliseconds: 3619, amplitude: 1, shake: 0.18 },
  { elapsedMilliseconds: 5000, amplitude: 1, shake: 0.55 },
];

const MORPH_CASES = [
  { seed: "alain", from: "idle", to: "mad", curve: MORPH_IN },
  {
    seed: "expression-organic",
    from: "thinking",
    to: "idle",
    curve: MORPH_OUT,
  },
] as const;

const MORPH_SAMPLES = [0, 0.25, 0.5, 0.75, 1];

const cases: unknown[] = [];

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

const ellipseOut = (e: Record<string, number>) => ({
  cx: e.cx,
  cy: e.cy,
  rx: e.rx,
  ry: e.ry,
  ...(e.n !== undefined ? { n: e.n } : {}),
  ...(e.rot !== undefined ? { rot: e.rot } : {}),
});

function caseOut(name: string, opts?: Record<string, unknown>) {
  const l = _layout(name, opts);
  return {
    seed: name,
    options: opts ?? {},
    shape: l.shape,
    body: {
      ...ellipseOut(l.body),
      radii: l.body.radii,
      ...(l.body.sides !== undefined ? { sides: l.body.sides } : {}),
      ...(l.body.round !== undefined ? { round: l.body.round } : {}),
    },
    face: ellipseOut(l.face),
    eyes: l.eyes.map(ellipseOut),
    petals: l.petals.map((p: Record<string, number>) => ({
      cx: p.cx,
      cy: p.cy,
      r: p.r,
    })),
    extra: l.extra,
    bodyPath: l.draw ? l.draw(l.body) : superellipse(l.body),
    eyePaths: l.eyes.map((e: Record<string, number>) => superellipse(e)),
    palette: { bg: l.palette.bg, head: l.palette.head, eye: l.palette.eye },
  };
}

function expressionCaseOut(
  seed: string,
  opts: Record<string, unknown>,
  expression: unknown,
) {
  const output = caseOut(seed, { ...opts, expression });
  return { ...output, options: opts };
}

function main() {
  let exportedWith = "unknown";
  try {
    exportedWith = execSync("git rev-parse HEAD", {
      cwd: SRC,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    // Not a git tree (e.g. an extracted tarball); the version pin still holds.
  }
  let motionExportedWith = "unknown";
  try {
    motionExportedWith = execSync("git rev-parse HEAD", {
      cwd: MOTION_SRC,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    // The evaluator may also come from an extracted source archive.
  }

  // Silhouette-band coverage: scan seeds until every band has its quota.
  const quota = 25;
  const seen = new Map<string, number>();
  for (
    let i = 0;
    seen.size < 10 || [...seen.values()].some((n) => n < quota);
    i++
  ) {
    const seed = `user-${i}`;
    const l = _layout(seed);
    seen.set(l.shape, (seen.get(l.shape) ?? 0) + 1);
    cases.push(caseOut(seed));
    if (i > 20000) throw new Error("band scan did not converge");
  }

  // Option variants: each band pinned, hue/tone pins, renderer toggles.
  for (const [, v] of SHAPE_PINS) {
    cases.push(caseOut("fixed-avatar", { traits: { shape: v } }));
  }
  for (const hue of [0, 210, 359]) cases.push(caseOut("hue-case", { hue }));
  for (const tone of [0, 0.5, 0.999])
    cases.push(caseOut("tone-case", { tone }));
  cases.push(caseOut("both-case", { hue: 300, tone: 0.8 }));
  cases.push(caseOut("contrast:off", { contrast: false }));
  cases.push(caseOut("normalize:off", { normalize: false }));
  for (const [seed, overrides] of OVERRIDE_CASES) {
    cases.push(caseOut(seed, { traits: overrides }));
  }

  const vectors = {
    meta: {
      schemaVersion: 3,
      upstream: "https://github.com/Alain00/blobatar",
      version: "2.4.0",
      generation: "gen2",
      exportedWith,
      motionExportedWith,
      sourceDir: "v2.4.0:packages/blobatar/src",
      caseCount: cases.length,
      expressionCaseCount: EXPRESSION_NAMES.length * EXPRESSION_CASES.length,
      motionCaseCount: MOTION_CASES.length,
      motionFrameCount: MOTION_CASES.length * MOTION_SAMPLES.length,
      shapeCounts: Object.fromEntries(
        [...seen.entries()].sort(([a], [b]) => a.localeCompare(b)),
      ),
      comparisonRules: {
        exact: [
          "hash-state",
          "stream-floats",
          "palette-hex",
          "path-strings",
          "shape-names",
          "motion-seeds",
          "motion-colors",
        ],
        relativeTolerance: {
          layout: 1e-9,
          motion: 1e-9,
          note:
            "dart:math cos/sin/pow/asin call the host C math library; IEEE 754 does not " +
            "mandate one bit-exact implementation. Cross-engine differences of one ULP are " +
            "expected in trig-derived layout floats and are not parity failures. Values " +
            "rounded by r2 (path data) must still match exactly.",
        },
      },
    },
    hash: HASH_SEEDS.map((seed) => {
      const state = seedState(seed);
      const streams: Record<string, number> = {};
      for (const k of KEYS) streams[k] = stream(state, k);
      return {
        seed,
        normalized: normalizeSeed(seed),
        state,
        streams,
      };
    }),
    overrides: OVERRIDE_CASES.map(([seed, overrides]) => {
      const t = traits(seed, true, overrides);
      const values: Record<string, number> = {};
      for (const k of [...Object.keys(overrides), "shape", "hue", "tone"]) {
        values[k] = t(k);
      }
      return { seed, overrides, values };
    }),
    palette: HUES.flatMap((hue) =>
      TONES.map((tone) => {
        const r = ramp(hue, true, tone);
        const rRaw = ramp(hue, false, tone);
        const hexed: Record<string, string> = {};
        for (const k in r) hexed[k] = toHex(r[k]);
        return {
          hue,
          tone,
          ramp: { bg: { ...r.bg }, head: { ...r.head }, eye: { ...r.eye } },
          rampUnenforced: {
            bg: { ...rRaw.bg },
            head: { ...rRaw.head },
            eye: { ...rRaw.eye },
          },
          hex: hexed,
        };
      }),
    ),
    expressions: Object.fromEntries(
      EXPRESSION_NAMES.map((name) => {
        const expression = expressionModule[name];
        return [
          name,
          {
            pose: expression.p,
            cases: EXPRESSION_CASES.map(({ seed, options }) =>
              expressionCaseOut(seed, options, expression),
            ),
          },
        ];
      }),
    ),
    motion: {
      durations: {
        breathe: 2800,
        bob: 3400,
        rock: 900,
        shake: 112,
        ambientRamp: 400,
        hoverEnter: 220,
        hoverExit: 160,
        expressionEnter: MORPH_IN.ms,
        expressionExit: MORPH_OUT.ms,
      },
      cases: MOTION_CASES.map(({ seed, options }) => {
        const seeds = idleSeeds(seed, options);
        return {
          seed,
          options,
          seeds,
          frames: MOTION_SAMPLES.map((sample) => ({
            ...sample,
            frame: idleAt(
              seeds,
              sample.elapsedMilliseconds,
              sample.amplitude,
              sample.shake,
            ),
          })),
        };
      }),
      morphs: MORPH_CASES.map(({ seed, from, to, curve }) => {
        const base = _layout(seed);
        const fromExpression =
          from === "idle" ? undefined : expressionModule[from];
        const toExpression = to === "idle" ? undefined : expressionModule[to];
        const fromLayout = fromExpression
          ? _layout(seed, { expression: fromExpression })
          : base;
        const toLayout = toExpression
          ? _layout(seed, { expression: toExpression })
          : base;
        return {
          seed,
          from,
          to,
          durationMilliseconds: curve.ms,
          samples: MORPH_SAMPLES.map((progress) => {
            const eased = curve.ease(progress);
            return {
              progress,
              eased,
              pose: lerpPose(fromExpression?.p, toExpression?.p, eased),
              head: fadeHex(
                fromLayout.palette.head,
                toLayout.palette.head,
                eased,
              ),
              eye: fadeHex(fromLayout.palette.eye, toLayout.palette.eye, eased),
            };
          }),
        };
      }),
    },
    cases,
  };

  mkdirSync(resolve(OUT, ".."), { recursive: true });
  writeFileSync(OUT, JSON.stringify(vectors, null, 1) + "\n");
  console.log(
    `wrote ${OUT}: ${vectors.cases.length} layout cases, ` +
      `${vectors.hash.length} hash vectors, ${vectors.palette.length} palette vectors, ` +
      `${vectors.meta.expressionCaseCount} expression cases, ` +
      `${vectors.meta.motionFrameCount} motion frames`,
  );
  console.log(`shape counts: ${JSON.stringify(vectors.meta.shapeCounts)}`);
}

main();
