import { describe, expect, test } from "bun:test";
import { travelVars } from "../src/animate";
import { blobatar, _parts } from "../src/blobatar";
import type { Traits } from "../src/traits";

const SEEDS = Array.from({ length: 100 }, (_, i) => `traveler-${i}`);

/**
 * The trait reader is stubbed, not seeded, so these tests pin the *mapping* —
 * what the vars function does with values it is handed — independently of the
 * hash. The determinism and independence guarantees are `traits.ts`'s own and
 * are pinned there.
 */
function stubTraits(values: Record<string, number>, picks: Record<string, number> = {}): Traits {
  const fn = ((key: string) => values[key] ?? 0) as Traits;
  fn.num = (key, min, max) => min + (values[key] ?? 0) * (max - min);
  fn.int = (key, min, max) =>
    Math.min(max, Math.floor(min + (values[key] ?? 0) * (max - min + 1)));
  fn.pick = (key, options) => options[Math.floor((picks[key] ?? values[key] ?? 0) * options.length)]!;
  fn.bool = (key, p = 0.5) => (values[key] ?? 0) < p;
  fn.jitter = (key, amount) => ((values[key] ?? 0) * 2 - 1) * amount;
  return fn;
}

describe("travelVars", () => {
  test("the four directions map to the four signed unit vectors", () => {
    const dir = (name: string) =>
      stubTraits(
        { "travel.dist": 0.5 },
        { "travel.dir": { ltr: 0, rtl: 0.25, ttb: 0.5, btt: 0.75 }[name]! },
    );
    const vars = (name: string) => {
      const v = travelVars(dir(name));
      return [v["--mo-tx"], v["--mo-ty"]];
    };
    // Same distance for all four: pick lands on dir only, dist reads its own key.
    expect(vars("ltr")).toEqual(["6px", "0px"]); // dist 0.5 → midpoint of [3, 9]
    expect(vars("rtl")).toEqual(["-6px", "0px"]);
    expect(vars("ttb")).toEqual(["0px", "6px"]);
    expect(vars("btt")).toEqual(["0px", "-6px"]);
  });

  test("timing is emitted negated and in milliseconds", () => {
    const t = stubTraits({ "travel.dist": 0, "travel.period": 0.5, "travel.phase": 0.25 });
    const v = travelVars(t);
    expect(v["--mo-t-period"]).toBe("12500ms");
    expect(v["--mo-t-phase"]).toMatch(/^-/); // negated at the source
    expect(v["--mo-tx"]).toBe("3px"); // dist 0 → bottom of [3,9]
  });

  test("lean stays inside the ±2° ceiling", () => {
    for (const x of [0, 0.2, 0.5, 0.8, 1]) {
      const lean = travelVars(stubTraits({ "travel.lean": x }))["--mo-t-lean"]!;
      expect(Math.abs(parseFloat(lean))).toBeLessThanOrEqual(2);
    }
  });
});

describe("travel option", () => {
  test("static output never changes — byte for byte", () => {
    // Decision 1 of the plan: goldens stay frozen; a static render that grew
    // one byte for travel would be a major wearing a minor's clothes.
    for (const s of SEEDS) {
      for (const travel of ["ltr", "rtl", "ttb", "btt", "seeded"] as const) {
        expect(blobatar(s, { travel })).toBe(blobatar(s));
      }
    }
  });

  test("animated markup carries the vars only when traveling", () => {
    for (const s of SEEDS) {
      // The travel wrapper and the depth layers are part of the animated path
      // itself — uniform structure, so the stylesheet and the probe can rely on
      // it — but the seeded vector exists only when the caller asks for it.
      const off = _parts(s, { animate: "hover" });
      expect(off.inner).toContain('class="mo-travel"');
      expect(Object.keys(off.vars ?? {})).not.toContain("--mo-tx");

      const on = _parts(s, { animate: "hover", travel: "ltr" });
      expect(on.inner).toContain('class="mo-travel"');
      expect(on.vars!["--mo-tx"]).toMatch(/^[\d.]+px$/);
      expect(Object.keys(on.vars!)).toContain("--mo-t-period");
    }
  });

  test("every seed gets some direction — the grid walks every way at once", () => {
    const seen = new Set(
      SEEDS.map((s) => {
        const v = _parts(s, { animate: "hover", travel: "seeded" }).vars!;
        return `${v["--mo-tx"]}/${v["--mo-ty"]}`;
      }),
    );
    // Not a guarantee of all four on any fixed corpus, but a hundred seeds
    // producing fewer than three directions would mean the pick is broken.
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  test("same name plus same travel renders identically across calls", () => {
    const a = _parts("alain@example.com", { animate: "hover", travel: "seeded" });
    const b = _parts("alain@example.com", { animate: "hover", travel: "seeded" });
    expect(a).toEqual(b);
  });

  test("no ids are emitted, even with depth layers in the markup", () => {
    // The depth layers would love a per-seed gradient; gradients need ids; this
    // library emits none (test/blobatar.test.ts pins it for the static path).
    const { inner } = _parts("alain", { animate: "hover", travel: "btt" });
    expect(inner).not.toContain("id=");
    expect(inner).not.toContain("<defs");
    expect(inner).not.toContain("url(");
  });
});
