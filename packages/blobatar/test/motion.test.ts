import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { motionVars } from "../src/animate";
import { blobatar, _layout, _parts } from "../src/blobatar";
import { traits } from "../src/traits";

const SEEDS = Array.from({ length: 300 }, (_, i) => `user-${i}`);

const ms = (v: string) => Number(v.replace("ms", ""));

describe("markup", () => {
  test("static output is untouched by the motion layer", () => {
    // The whole opt-in design rests on this: adding animation cost nothing to
    // the people who never asked for it.
    for (const s of SEEDS) {
      expect(blobatar(s)).not.toContain("mo-");
      expect(blobatar(s)).not.toContain("style=");
    }
  });

  test("animating nests the transform layers and marks each eye", () => {
    const { cls, inner } = _parts("alain", { animate: "hover" });

    // One transform property per element, so hover-lift, travel, breathe and bob
    // need four elements or they overwrite each other. The hover-lift one is the
    // caller's — its class varies with the expression, and anything that varies
    // inside this string costs the morph. See `makeParts`. Travel wraps
    // everything (it is the whole figure moving); breathe and bob sit inside it.
    expect(cls).toBe("mo-root");
    expect(inner).toStartWith(
      '<g class="mo-travel"><ellipse',
    );
    expect(inner).toContain('<g class="mo-breathe"><g class="mo-bob">');
    expect(inner).not.toContain("mo-root");
    expect(inner.match(/class="mo-eye"/g)).toHaveLength(2);
  });

  test("travel markup appears only when asked for", () => {
    // The depth layers ride the same branch as every other motion-only byte:
    // static output is frozen per major, so an animated-only render is the only
    // place new geometry can appear. See the plan in
    // docs/3d-directional-motion-plan.md, decision 1.
    for (const s of SEEDS) {
      expect(blobatar(s, { travel: "ltr" })).toBe(blobatar(s));
      const off = _parts(s, { animate: "hover" });
      expect(off.inner).not.toContain("--mo-tx");
      expect(Object.keys(off.vars ?? {})).not.toContain("--mo-tx");
      const on = _parts(s, { animate: "hover", travel: "seeded" });
      expect(on.inner).toContain('class="mo-travel"');
      expect(Object.keys(on.vars!)).toContain("--mo-tx");
    }
  });

  test("the eye class rides a wrapper, not the shape", () => {
    // The wrapper is where the pose lives, and it exists because a pose channel
    // inside `@keyframes` stops interpolating in Gecko — see the rule below and
    // `docs/expression-followups.md` §8. Collapsing these two elements back into
    // one is silent in Chrome and breaks the morph in Firefox.
    const { inner } = _parts("alain", { animate: "hover" });
    expect(
      inner.match(/<g class="mo-eye" style="[^"]+"><path d="[^"]+"\/><\/g>/g),
    ).toHaveLength(2);
  });

  test("no pose channel is read from inside a keyframe", () => {
    // The rule the wrapper exists to satisfy, asserted where it is cheap to
    // assert. Firefox substitutes a keyframe's `var()` from the transition's
    // endpoint rather than its current value, so any pose channel that ends up
    // in one snaps to the target pose on the first frame while the rest of the
    // face eases. `scripts/probe-compose.ts` catches it too, but only if
    // somebody has Firefox installed; this catches it in `bun test`.
    const css = readFileSync(
      new URL("../src/motion.css", import.meta.url),
      "utf8",
    );
    const posed = /--mo-(esx|esy|tilt|edx|edy|bdy|shake|x|y|t)\b/;
    for (const [block] of css.matchAll(/@keyframes [\w-]+ \{[^@]*?\n\}/g)) {
      const name = block.slice(0, block.indexOf(" {"));
      // `mo-shake` is the exception and is not a transitioned channel in the
      // same sense: it is an amplitude on a loop, and a loop is the only thing
      // a tremor can be. It still interpolates, because what interpolates is
      // the amplitude the keyframes read — the same trade `--mo-amp` makes.
      if (name === "@keyframes mo-shake") continue;
      // `mo-travel` is the same exception one layer out: its keyframes read the
      // seeded per-blobatar travel vector (`--mo-tx`, `--mo-ty`, `--mo-t-lean`),
      // which is never transitioned and positions nothing the pose owns — the
      // regex catches them only because `--mo-t-` shares a prefix with `--mo-t`.
      if (name === "@keyframes mo-travel") continue;
      const hit = block.match(posed);
      expect(hit ? `${name} reads ${hit[0]}` : name).toBe(name);
    }
  });

  test("both eyes share one group, so they glance together", () => {
    // Independent eye movement reads as a lazy eye instantly, so the saccade
    // layer has to sit on the shared group with blink underneath it.
    const { inner } = _parts("alain", { animate: "hover" });
    const group = inner.slice(inner.indexOf("mo-eyes"));
    expect(inner.match(/class="mo-eyes"/g)).toHaveLength(1);
    expect(group.match(/class="mo-eye"/g)).toHaveLength(2);
  });

  test("each eye carries its own baked lean", () => {
    // `superellipse` bakes rotation into the coordinates, so every scale in the
    // stylesheet has to counter-rotate by this angle or it squashes along screen
    // axes and shears the capsule. Without the value there is nothing to
    // counter-rotate *by* — and the failure is silent, because a sheared eye is
    // still an eye.
    const { inner } = _parts("alain", { animate: "hover" });
    const leans = [...inner.matchAll(/--mo-lean:(-?[\d.]+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(leans).toHaveLength(2);
    const eyes = _layout("alain").eyes as { rot: number }[];
    for (const [i, lean] of leans.entries())
      expect(lean).toBeCloseTo(eyes[i]!.rot, 1);
  });

  test("the eyes carry opposite wrap sides", () => {
    // The wrap layer's tilt converges the two eyes toward the pole, and its
    // foreshortening is heavier on whichever eye leads the turn. Both read this
    // sign. Same sign on both would turn a sphere back into a head tilting.
    const { inner } = _parts("alain", { animate: "hover" });
    expect(inner).toContain('style="--mo-wrap:-1;');
    expect(inner).toContain('style="--mo-wrap:1;');
    expect(inner.match(/--mo-wrap:/g)).toHaveLength(2);
    // Left eye first, so the sign matches the side it is drawn on.
    expect(inner.indexOf("--mo-wrap:-1")).toBeLessThan(
      inner.indexOf("--mo-wrap:1"),
    );
  });

  test("always mode is a class, not a second code path", () => {
    expect(_parts("alain", { animate: "always" }).cls).toBe(
      "mo-root mo-always",
    );
  });

  test("the backdrop comes back as geometry, outside the motion wrapper", () => {
    // A plate that hover-lifts and breathes with the creature stops being a
    // plate. It used to be a string concatenated ahead of the wrapper; now it
    // leaves as `bg` so the adapter can draw it as a sibling of the root `<g>`
    // — which is what lets the root `<g>` be a real React element at all.
    const { bg, inner } = _parts("alain", {
      animate: "hover",
      background: "square",
    });
    expect(bg).toEqual({ d: "M0 0H100V100H0Z", fill: expect.any(String) });
    expect(inner).not.toContain("M0 0H100V100H0Z");
    expect(_parts("alain", { animate: "hover" }).bg).toBeUndefined();
  });

  test("the title never enters the markup string", () => {
    // `<title>` names the element it is the first child of, so it has to be a
    // child of the `<svg>`. React renders it, which also means React escapes it.
    const { inner } = _parts("alain", { animate: "hover", title: "Ada" });
    expect(inner).not.toContain("<title>");
    expect(inner).toStartWith('<g class="mo-travel">');
  });

  test("markup stays balanced with the wrapper in place", () => {
    for (const s of SEEDS.slice(0, 50)) {
      const { inner } = _parts(s, { animate: "hover" });
      const open = (inner.match(/<(?!\/)[a-z]/g) ?? []).length;
      const close =
        (inner.match(/<\/[a-z]/g) ?? []).length +
        (inner.match(/\/>/g) ?? []).length;
      expect(open).toBe(close);
    }
  });
});

describe("timing", () => {
  test("delays are negative, so blobatars start mid-cycle", () => {
    // A positive delay postpones the start instead of offsetting the phase:
    // the grid still opens in unison, after an awkward pause.
    for (const s of SEEDS) {
      const v = motionVars(traits(s));
      expect(ms(v["--mo-phase"]!)).toBeLessThanOrEqual(0);
      expect(ms(v["--mo-bob-phase"]!)).toBeLessThanOrEqual(0);
      expect(ms(v["--mo-blink-phase"]!)).toBeLessThanOrEqual(0);
    }
  });

  test("phases span their period and do not cluster", () => {
    // The failure this guards is a grid that breathes as one heartbeat.
    const buckets = new Set(
      SEEDS.map((s) =>
        Math.floor((-ms(motionVars(traits(s))["--mo-phase"]!) / 2800) * 10),
      ),
    );
    expect(buckets.size).toBe(10);
  });

  test("breathe and bob drift independently", () => {
    // Sharing one offset keeps the two periods drifting apart but locks every
    // blobatar into the same drift — unison again, one level up.
    const same = SEEDS.filter((s) => {
      const v = motionVars(traits(s));
      return (
        Math.abs(
          ms(v["--mo-phase"]!) / 2800 - ms(v["--mo-bob-phase"]!) / 3400,
        ) < 0.01
      );
    });
    expect(same.length).toBeLessThan(SEEDS.length * 0.05);
  });

  test("blink phase stays inside its own period", () => {
    for (const s of SEEDS) {
      const v = motionVars(traits(s));
      const period = ms(v["--mo-blink"]!);
      expect(period).toBeGreaterThanOrEqual(3500);
      expect(period).toBeLessThanOrEqual(6500);
      expect(-ms(v["--mo-blink-phase"]!)).toBeLessThanOrEqual(period);
    }
  });

  test("glance directions are never near zero", () => {
    // Drawn as magnitude × sign rather than as a symmetric jitter: a seed that
    // drew 0.02 would have eyes that technically animate and visibly do not.
    for (const s of SEEDS) {
      const v = motionVars(traits(s));
      expect(Math.abs(Number(v["--mo-look-x"]))).toBeGreaterThanOrEqual(1);
      expect(Math.abs(Number(v["--mo-look-y"]))).toBeGreaterThanOrEqual(0.8);
      expect(Math.abs(Number(v["--mo-look-x"]))).toBeLessThanOrEqual(2.2);
      expect(Math.abs(Number(v["--mo-look-y"]))).toBeLessThanOrEqual(1.7);
    }
  });

  test("look magnitudes are the unsigned form of the signed ones", () => {
    // The wrap layer foreshortens by how far the eyes travelled, which is
    // sign-independent, and CSS has no portable abs(). If these two ever drift
    // apart, a mirrored blobatar foreshortens the wrong way — it would read as the
    // eyes bulging on a glance rather than compressing, in exactly half the grid.
    for (const s of SEEDS) {
      const v = motionVars(traits(s));
      expect(Number(v["--mo-look-mx"])).toBe(
        Math.abs(Number(v["--mo-look-x"])),
      );
      expect(Number(v["--mo-look-my"])).toBe(
        Math.abs(Number(v["--mo-look-y"])),
      );
      expect(Number(v["--mo-look-mx"])).toBeGreaterThan(0);
      expect(Number(v["--mo-look-my"])).toBeGreaterThan(0);
    }
  });

  test("glances go in every direction across a grid", () => {
    // One shared @keyframes walks one sequence of fixations, so the only thing
    // stopping 400 blobatars looking the same way at the same moment is the sign
    // of these two. All four quadrants have to show up.
    const quadrants = new Set(
      SEEDS.map((s) => {
        const v = motionVars(traits(s));
        return `${Number(v["--mo-look-x"]) > 0}${Number(v["--mo-look-y"]) > 0}`;
      }),
    );
    expect(quadrants.size).toBe(4);
  });

  test("saccade period is its own, not locked to blink", () => {
    for (const s of SEEDS) {
      const v = motionVars(traits(s));
      const period = ms(v["--mo-saccade"]!);
      expect(period).toBeGreaterThanOrEqual(4200);
      expect(period).toBeLessThanOrEqual(7600);
      expect(-ms(v["--mo-saccade-phase"]!)).toBeLessThanOrEqual(period);
    }
  });

  test("no wrap stop can make an eye grow", () => {
    // The guarantee behind the differential term: the eye leading a turn
    // compresses *more* than the trailing one, but the trailing one still
    // compresses. If the signed coefficient ever caught up with the shared one,
    // that eye would scale past 1 on a glance — and an eye swelling as it looks
    // sideways is the single tell that kills the sphere read.
    const css = readFileSync(
      new URL("../src/motion.css", import.meta.url),
      "utf8",
    );
    const wrap = css.slice(css.indexOf("@keyframes mo-wrap"));

    const stops = [
      ...wrap.matchAll(
        /1 - ([\d.]+) \* var\(--mo-look-mx[^)]*\) \* var\(--mo-amp\) ([+-]) ([\d.]+)/g,
      ),
    ];
    expect(stops).toHaveLength(5); // every stop but the two zeroed ones

    for (const [, shared, , signed] of stops) {
      expect(Number(signed)).toBeLessThan(Number(shared));
    }
  });

  test("reading motion traits leaves every existing trait untouched", () => {
    // Trait keys are string-addressed, so this should hold by construction.
    // It is asserted anyway because it is the property the whole keyed-stream
    // design exists to provide, and a regression here reshuffles every blobatar
    // that has ever been rendered.
    const geometry = (svg: string) => svg.match(/ d="[^"]+"|<circle[^/]+/g);

    for (const s of SEEDS.slice(0, 50)) {
      const before = blobatar(s);
      motionVars(traits(s));
      expect(blobatar(s)).toBe(before);
      // Same shapes, same numbers — the animated build differs only by the
      // wrapper and the eye class.
      expect(geometry(_parts(s, { animate: "hover" }).inner)).toEqual(
        geometry(before),
      );
    }
  });
});
