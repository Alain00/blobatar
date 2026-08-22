/**
 * Composition gate — the one check that needs a real browser.
 *
 * `bun test` can prove a great deal about this library from strings alone, and
 * it proved nothing at all about the two failures that shipped: eyes that
 * deformed on the wrong axis, and a morph that never ran. Both live in the gap
 * between what the renderer emits and what a CSS engine does with it, and
 * nothing in a string can see across that gap.
 *
 * So this bundles the real source, loads it in headless Chrome, and measures
 * pixels. It is deliberately *not* a `bun test` file: it needs a browser on the
 * machine, and a test file that silently skips when one is missing is worse than
 * no test, because the suite still reports green. Run explicitly, and part of
 * `bun run check`, which warns loudly rather than passing quietly when there is
 * no Chrome to run.
 *
 * See `scripts/probe/entry.tsx` for what is actually asserted, and
 * `docs/motion-probe.html` for the hand-run probe of the idle layers, which this
 * does not replace — that one is about whether the motion *reads* well.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { blobatar, _layout, _parts } from "../src/blobatar";
import {
  happy,
  idle,
  love,
  mad,
  sad,
  scared,
  shy,
  sick,
  sleepy,
  smug,
  surprised,
  thinking,
  unsure,
  wink,
  type Expression,
} from "../src/expression";

/**
 * Two engines, and the second one is not redundant.
 *
 * Blink and Gecko disagree about where a keyframe's `var()` comes from while a
 * transition is running on it, and the whole expression morph is built on that
 * substitution. Chrome reports the pose interpolating; Firefox rendered the eye
 * scale and tilt snapping to the endpoint on frame one, for as long as those
 * channels lived inside `@keyframes` — green here, broken in a third of the
 * world's browsers, and invisible to every check in this file because the page
 * was only ever opened in one of them. See `.mo-eye` in `src/motion.css`.
 *
 * WebKit is the gap that remains. It cannot be driven from Linux CI, so the same
 * class of divergence could still be hiding there.
 */
const BROWSERS = [
  {
    name: "chrome",
    bins: [
      process.env.CHROME,
      "google-chrome",
      "google-chrome-stable",
      "chromium",
      "chromium-browser",
    ],
    // Headless throttles rAF and animation frames in hidden pages; without
    // these a transition simply never advances between samples.
    args: (url: string, dir: string) => [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      `--user-data-dir=${dir}`,
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      url,
    ],
  },
  {
    name: "firefox",
    bins: [process.env.FIREFOX, "firefox"],
    // A profile of its own, or this refuses to start whenever the developer
    // happens to have Firefox open — and `--new-instance` is what stops it
    // handing the URL to that window instead of running the probe.
    args: (url: string, dir: string) => [
      "--headless",
      "--new-instance",
      "--profile",
      dir,
      url,
    ],
  },
];

const found = BROWSERS.map((b) => ({
  ...b,
  // A missing binary makes Bun.spawnSync throw rather than report failure, so
  // each candidate is probed defensively — an absent Firefox must skip the
  // row, not take the whole probe down.
  bin: (b.bins.filter(Boolean) as string[]).find((bin) => {
    try {
      return Bun.spawnSync([bin, "--version"], { stderr: "ignore" }).success;
    } catch {
      return false;
    }
  }),
})).filter((b) => b.bin);

if (!found.length) {
  console.warn(
    "! composition gate SKIPPED — no browser found.\n" +
      "  This is the only check that can see a CSS-versus-geometry divergence.\n" +
      "  Install Chrome or Firefox, or set CHROME=/path/to/binary, before" +
      " trusting a green run.",
  );
  process.exit(0);
}
for (const b of BROWSERS)
  if (!found.some((f) => f.name === b.name))
    console.warn(
      `! ${b.name} not found — the gate ran one engine, and the bug this file` +
        ` was extended for was visible in exactly one engine.`,
    );

/**
 * Every pose, not a sample of them.
 *
 * Check A compares a baked pose against the same pose expressed as CSS, and the
 * channels most able to disagree are the per-eye differentials — `bakePose` adds
 * them to eye index 1 while `motion.css` selects the right eye through
 * `--mo-sel`, and nothing but this gate makes those two agree about which eye is
 * the second one. `wink` and `unsure` lean on that channel harder than anything
 * in the first roster, so leaving them out would be leaving out the cases the
 * check is for. Same argument for check E and the three tinting poses.
 */
const POSES: [string, Expression | undefined][] = [
  ["idle", undefined],
  ["happy", happy],
  ["sad", sad],
  ["mad", mad],
  ["surprised", surprised],
  ["wink", wink],
  ["sleepy", sleepy],
  ["smug", smug],
  ["unsure", unsure],
  ["scared", scared],
  ["love", love],
  ["shy", shy],
  ["sick", sick],
  ["thinking", thinking],
];

/**
 * Seeds chosen by lean, not at random. The bug this gate exists for is
 * invisible at lean 0 and worst at the 12° ceiling, so a uniform sample would
 * mostly measure the cases that cannot fail.
 */
const seeds = Array.from({ length: 600 }, (_, i) => `seed-${i}`)
  .map((s) => ({
    s,
    lean: Math.max(
      ...(_layout(s).eyes as { rot: number }[]).map((e) => Math.abs(e.rot)),
    ),
  }))
  .sort((a, b) => b.lean - a.lean)
  .slice(0, 12);

const strip = (svg: string) =>
  svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"));

/** Only the fields `outline()` needs, and only the eyes. */
const eyes = (l: ReturnType<typeof _layout>) =>
  (l.eyes as { cx: number; cy: number; rx: number; ry: number; rot: number }[])
    .map(({ cx, cy, rx, ry, rot }) => ({ cx, cy, rx, ry, rot }));

const cases = seeds.flatMap(({ s, lean }) =>
  POSES.map(([name, e]) => {
    const p = _parts(s, { animate: "always", expression: e });
    return {
      seed: s,
      name,
      lean,
      static: strip(blobatar(s, { expression: e ?? idle })),
      cls: p.cls!,
      inner: p.inner,
      vars: p.vars!,
      // The pose baked in, and the same blobatar without it. The page draws the
      // second and asks whether CSS turns it into the first.
      posed: eyes(_layout(s, { expression: e ?? idle })),
      base: eyes(_layout(s)),
      // What the *static* path paints. A tinting pose resolves its colour into
      // the markup here and into `--mo-head`/`--mo-eye` on the animated side,
      // which are two serializations of one decision and have nothing forcing
      // them to agree — the same gap check A exists for, one axis over.
      fill: (() => {
        const l = _layout(s, { expression: e ?? idle });
        return [l.palette.head!, l.palette.eye!];
      })(),
    };
  }),
);

const DIR = "scripts/.probe";
rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });

const build = await Bun.build({
  entrypoints: ["scripts/probe/entry.tsx"],
  target: "browser",
  define: { "process.env.NODE_ENV": '"development"' },
});
if (!build.success) {
  for (const log of build.logs) console.error(log);
  process.exit(1);
}

// Both scripts go to disk and load by `src`. Inlined, React's development
// build closes the `<script>` early on the first `</script>` inside one of its
// own string literals, and the rest of the bundle parses as markup — which
// presents as a page that simply produces no result.
writeFileSync(`${DIR}/cases.js`, `window.CASES=${JSON.stringify(cases)}`);
writeFileSync(`${DIR}/probe.js`, await build.outputs[0]!.text());

const css = readFileSync(new URL("../src/motion.css", import.meta.url), "utf8");
const file = `${DIR}/probe.html`;
writeFileSync(
  file,
  `<!doctype html><meta charset="utf-8"><style>${css}
/* Has to sit on \`.mo-root\` itself: \`--mo-amp\` is declared on that element, and
   an element's own declaration beats an inherited one however important the
   ancestor's is. At amplitude 0 every idle layer folds to the identity, so what
   is left on screen is the pose and nothing else.

   \`--mo-shake\` is pinned for a different reason. It is not ambient — it is part
   of the pose — but it is the one pose channel the static path cannot express,
   because a bake is a still frame and a tremor is a loop. Leaving it running
   makes check A compare a shaking blobatar against a stationary one and report the
   phase it happened to sample as a divergence, which is exactly what it did:
   0.37px of "disagreement" that was the feature working. Check D below measures
   it properly, unfrozen. Check I does the same for the seesaw.

   The seesaw is pinned by its *phase* and not by its amplitude, which is the
   whole difference between it and the tremor: the bake can express it, at one
   phase. \`--mo-rockp: 1\` is frame zero, where \`(1 + wrap · phase) / 2\`
   collapses to \`--mo-sel\` and the composition has to land exactly on what
   \`bakePose\` emitted. Pinning \`--mo-rock: 0\` instead would also make A pass and
   would prove less: it would take the blend out of the measurement rather than
   asserting the identity the blend is built on. */
.mo-frozen {
  --mo-amp: 0 !important;
  --mo-shake: 0 !important;
  --mo-rockp: 1 !important;
}
.mo-frozen-amp { --mo-amp: 0 !important; }
body { margin: 0 }
</style><body><script src="cases.js"></script><script type="module" src="probe.js"></script>`,
);

type Result = { name: string; ok: boolean; detail: string; skip?: boolean };

/**
 * The page posts its verdicts back rather than being read out of the browser.
 *
 * This used to be a small CDP client, which is a fine way to drive Chrome and no
 * way at all to drive Firefox — Gecko speaks WebDriver BiDi and its CDP shim is
 * on the way out. One `fetch` from the page is the entire handoff, works in any
 * engine that can open a URL, and deletes a protocol implementation from this
 * repository. `globalThis.RESULTS` is still set, for a hand-run in a real
 * window.
 *
 * Served rather than opened from disk: a `type="module"` script on a `file://`
 * page has a null origin and is refused outright, which looks exactly like a
 * page that ran and found nothing.
 */
let deliver: (r: Result[]) => void = () => {};
const server = Bun.serve({
  port: 0,
  // `127.0.0.1`, not the default wildcard: Firefox will not open a
  // `http://0.0.0.0:…` URL at all, and does it by silently showing nothing.
  hostname: "127.0.0.1",
  async fetch(req) {
    if (req.method === "POST") {
      deliver((await req.json()) as Result[]);
      return new Response("ok");
    }
    const name = new URL(req.url).pathname.slice(1) || "probe.html";
    const f = Bun.file(`${DIR}/${name}`);
    // Chrome asks for a favicon unprompted; a thrown ENOENT here would be the
    // loudest thing in the output and mean nothing.
    return (await f.exists())
      ? new Response(f)
      : new Response(null, { status: 404 });
  },
});

const url = `${server.url}${file.split("/").pop()}`;
let failed = false;

for (const b of found) {
  // A profile per engine per run, inside the probe directory that is deleted at
  // the end: a shared one leaves the second run of the day inheriting the first
  // one's cache, and Firefox refuses to start on a profile another instance
  // holds. It has to live here rather than in /tmp — the snap-packaged Firefox
  // cannot see paths outside the home directory, and reports that as "already
  // running".
  const dir = `${process.cwd()}/${DIR}/${b.name}-profile`;
  mkdirSync(dir, { recursive: true });

  const reported = new Promise<Result[] | null>((resolve) => {
    deliver = resolve;
    // Generous, and a real bound: the geometry pass walks 48 cases a frame at a
    // time, which is the machine's business, but a page that throws before its
    // first check reports nothing at all and would otherwise hang the gate.
    setTimeout(() => resolve(null), 120_000).unref();
  });
  const proc = Bun.spawn([b.bin!, ...b.args(url, dir)], {
    stdout: "ignore",
    stderr: "ignore",
  });
  const results = await reported;
  deliver = () => {};
  proc.kill();

  console.log(`— ${b.name} (${b.bin})`);
  if (!results) {
    failed = true;
    console.error(`✗ composition gate — the page never reported a result`);
    continue;
  }
  for (const r of results) {
    failed ||= !r.ok;
    // `~` for a check this engine cannot measure — it is not a pass, and a
    // green tick against a check that never ran is the thing this whole file
    // exists to avoid.
    console.log(`${r.skip ? "~" : r.ok ? "✓" : "✗"} ${r.name} — ${r.detail}`);
  }
}

server.stop(true);
console.log(
  `  ${cases.length} case${cases.length === 1 ? "" : "s"}: ${seeds.length} of the` +
    ` most-leaned seeds × ${POSES.length} poses, leans ${seeds[seeds.length - 1]!.lean.toFixed(1)}–${seeds[0]!.lean.toFixed(1)}°` +
    ` × ${found.length} engine${found.length === 1 ? "" : "s"}`,
);

rmSync(DIR, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
