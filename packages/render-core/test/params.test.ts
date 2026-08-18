/**
 * The shared param table — the one place the `/v1` string vocabulary becomes
 * `BlobatarOptions`. Both the service and the CLI rely on this suite; neither
 * re-tests the table.
 */
import { describe, expect, test } from "bun:test";
import { happy, idle, mad, sad } from "blobatar/expression";

import { parseParams } from "../src/index";

describe("parseParams", () => {
  test("no params is valid and sets nothing", () => {
    const r = parseParams({});
    expect(r).toEqual({ ok: true, options: {}, canonical: {} });
  });

  describe("size", () => {
    test("accepts integers 16–1024", () => {
      expect(parseParams({ size: "16" })).toEqual({
        ok: true,
        options: { size: 16 },
        canonical: { size: "16" },
      });
      expect(parseParams({ size: "1024" })).toEqual({
        ok: true,
        options: { size: 1024 },
        canonical: { size: "1024" },
      });
    });

    test("canonicalizes leading zeros", () => {
      expect(parseParams({ size: "0256" })).toEqual({
        ok: true,
        options: { size: 256 },
        canonical: { size: "256" },
      });
    });

    test("rejects out-of-range and non-integer values", () => {
      const error = "size must be an integer between 16 and 1024";
      for (const size of ["15", "1025", "0", "1.5", "-64", "+64", "64px", "1e2", "", " 64"]) {
        expect(parseParams({ size })).toEqual({ ok: false, error });
      }
    });
  });

  describe("background", () => {
    test("passes shapes through and maps none to false", () => {
      for (const shape of ["squircle", "circle", "square"] as const) {
        expect(parseParams({ background: shape })).toEqual({
          ok: true,
          options: { background: shape },
          canonical: { background: shape },
        });
      }
      expect(parseParams({ background: "none" })).toEqual({
        ok: true,
        options: { background: false },
        canonical: { background: "none" },
      });
    });

    test("rejects anything else, case-sensitively", () => {
      const error = "background must be one of: squircle, circle, square, none";
      for (const background of ["Circle", "SQUARE", "rounded", "true", "false", ""]) {
        expect(parseParams({ background })).toEqual({ ok: false, error });
      }
    });
  });

  describe("hue", () => {
    test("accepts integer degrees 0–360", () => {
      expect(parseParams({ hue: "0" })).toEqual({
        ok: true,
        options: { hue: 0 },
        canonical: { hue: "0" },
      });
      expect(parseParams({ hue: "360" })).toEqual({
        ok: true,
        options: { hue: 360 },
        canonical: { hue: "360" },
      });
    });

    test("rejects floats and out-of-range degrees", () => {
      const error = "hue must be an integer between 0 and 360";
      for (const hue of ["361", "-1", "210.5", "12deg", ""]) {
        expect(parseParams({ hue })).toEqual({ ok: false, error });
      }
    });
  });

  describe("tone", () => {
    test("maps integers 0–100 to the library's 0–1 position", () => {
      expect(parseParams({ tone: "0" })).toEqual({
        ok: true,
        options: { tone: 0 },
        canonical: { tone: "0" },
      });
      expect(parseParams({ tone: "40" })).toEqual({
        ok: true,
        options: { tone: 0.4 },
        canonical: { tone: "40" },
      });
    });

    test("100 lands just under 1 — the tone range is half-open", () => {
      // The library buckets tone with `v < edge` and the last edge is 1.0, so
      // an exact 1 falls through and wraps to the FIRST swatch: tone=100 would
      // render the same bytes as tone=0. Verified empirically. The clamp value
      // is the library's own (traits.ts uses 0.999999 for overrides).
      expect(parseParams({ tone: "100" })).toEqual({
        ok: true,
        options: { tone: 0.999999 },
        canonical: { tone: "100" },
      });
    });

    test("rejects out-of-range and non-integer values", () => {
      const error = "tone must be an integer between 0 and 100";
      for (const tone of ["101", "-5", "0.4", ""]) {
        expect(parseParams({ tone })).toEqual({ ok: false, error });
      }
    });
  });

  describe("expression", () => {
    test("resolves names to the values the library exports", () => {
      // Identity, not shape: the glossary's "an expression is a value a
      // consumer imports, not a name it spells", translated to strings here
      // and nowhere else.
      const roster = { happy, sad, mad, idle };
      for (const [name, value] of Object.entries(roster)) {
        const r = parseParams({ expression: name });
        if (!r.ok) throw new Error(r.error);
        expect(r.options.expression).toBe(value);
        expect(r.canonical.expression).toBe(name);
      }
    });

    test("rejects anything off the roster", () => {
      const error = "expression must be one of: happy, sad, mad, idle";
      for (const expression of ["angry", "Happy", "wink", ""]) {
        expect(parseParams({ expression })).toEqual({ ok: false, error });
      }
    });

    test("rejects prototype keys — a 400, never a downstream crash", () => {
      // A plain-object roster answers truthily to "__proto__" and friends;
      // whatever comes back is not an Expression and would 500 in the render.
      const error = "expression must be one of: happy, sad, mad, idle";
      for (const expression of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
        expect(parseParams({ expression })).toEqual({ ok: false, error });
      }
    });
  });

  describe("normalize", () => {
    test("accepts the literals true and false", () => {
      expect(parseParams({ normalize: "true" })).toEqual({
        ok: true,
        options: { normalize: true },
        canonical: { normalize: "true" },
      });
      expect(parseParams({ normalize: "false" })).toEqual({
        ok: true,
        options: { normalize: false },
        canonical: { normalize: "false" },
      });
    });

    test("rejects everything else", () => {
      const error = "normalize must be true or false";
      for (const normalize of ["1", "0", "yes", "True", ""]) {
        expect(parseParams({ normalize })).toEqual({ ok: false, error });
      }
    });
  });

  test("params combine, and the first invalid one wins in allowlist order", () => {
    const r = parseParams({
      size: "512",
      background: "circle",
      hue: "210",
      tone: "40",
      expression: "happy",
      normalize: "false",
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.options).toEqual({
      size: 512,
      background: "circle",
      hue: 210,
      tone: 0.4,
      expression: happy,
      normalize: false,
    });
    // Two invalid params, one deterministic message: allowlist order decides
    // (`hue` sorts before `size`).
    expect(parseParams({ size: "bad", hue: "bad" })).toEqual({
      ok: false,
      error: "hue must be an integer between 0 and 360",
    });
  });
});
