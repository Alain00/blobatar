/**
 * render-core — the shared param table of blobatar's string surfaces.
 *
 * The `/v1` URL service and the CLI speak the same six-param vocabulary; this
 * package is the one place that vocabulary becomes `BlobatarOptions`, with one
 * set of validation rules and one set of error messages. It contains nothing
 * else: no rasterization (each consumer brings its own), no cache logic, no
 * I/O.
 *
 * Private and never published — see `package.json` for how each consumer
 * bundles it.
 */
import type { BlobatarOptions, Expression } from "blobatar";
import { happy, idle, mad, sad } from "blobatar/expression";

/**
 * The closed allowlist, pre-sorted — the order canonical cache keys serialize
 * params in. Anything not on this list is not contract surface.
 */
export const PARAM_NAMES = [
  "background",
  "expression",
  "hue",
  "normalize",
  "size",
  "tone",
] as const;

export type ParamName = (typeof PARAM_NAMES)[number];

/**
 * The table's one default: the PNG raster width when the caller names none.
 * SVG deliberately has no default — omitted, the markup scales via CSS.
 */
export const PNG_DEFAULT_SIZE = 256;

/** Param values as they arrive from a URL query or argv: raw strings. */
export type RawParams = Partial<Record<ParamName, string>>;

export type ParseResult =
  | {
      ok: true;
      options: BlobatarOptions;
      /**
       * The canonical string form of each param that was present — parsed and
       * re-serialized, so `size=0256` comes back as `"256"`. What a cache key
       * should embed; policy about *dropping* any of them stays with the
       * caller.
       */
      canonical: Partial<Record<ParamName, string>>;
    }
  | { ok: false; error: string };

/**
 * Digits only — no sign, no decimal point, no exponent, no whitespace. Leading
 * zeros are tolerated and canonicalized away, so `size=0256` and `size=256`
 * parse (and cache) identically.
 */
const DIGITS = /^[0-9]+$/;

/** Parses an integer within [min, max], or undefined when the string is not one. */
function integer(value: string, min: number, max: number): number | undefined {
  if (!DIGITS.test(value)) return undefined;
  const n = Number(value);
  return n >= min && n <= max ? n : undefined;
}

/**
 * The string half of the glossary rule "an expression is a value a consumer
 * imports, not a name it spells" — resolved here, in exactly one place, for
 * every string surface.
 */
const EXPRESSIONS: Record<string, Expression> = { happy, sad, mad, idle };

/**
 * Turns raw string params into `BlobatarOptions`, or one plain-text error.
 *
 * Validates in `PARAM_NAMES` order, so the reported error is deterministic
 * when several params are invalid at once. Only params that are present land
 * in `options` — an omitted param and its default must stay byte-equivalent.
 */
export function parseParams(raw: RawParams): ParseResult {
  const options: BlobatarOptions = {};
  const canonical: Partial<Record<ParamName, string>> = {};

  if (raw.background !== undefined) {
    const background = raw.background;
    if (background !== "squircle" && background !== "circle" && background !== "square" && background !== "none")
      return { ok: false, error: "background must be one of: squircle, circle, square, none" };
    // `none` is the library's own default (`background: false`, transparent) —
    // the mapping is what makes `background=none` byte-equivalent to omitting.
    options.background = background === "none" ? false : background;
    canonical.background = background;
  }

  if (raw.expression !== undefined) {
    // Own-property check: a plain object answers truthily to "__proto__" and
    // "constructor", and neither is an Expression — without this, a crafted
    // URL turns a 400 into a downstream crash.
    if (!Object.hasOwn(EXPRESSIONS, raw.expression))
      return { ok: false, error: "expression must be one of: happy, sad, mad, idle" };
    options.expression = EXPRESSIONS[raw.expression];
    canonical.expression = raw.expression;
  }

  if (raw.hue !== undefined) {
    const hue = integer(raw.hue, 0, 360);
    if (hue === undefined)
      return { ok: false, error: "hue must be an integer between 0 and 360" };
    options.hue = hue;
    canonical.hue = String(hue);
  }

  if (raw.normalize !== undefined) {
    if (raw.normalize !== "true" && raw.normalize !== "false")
      return { ok: false, error: "normalize must be true or false" };
    options.normalize = raw.normalize === "true";
    canonical.normalize = raw.normalize;
  }

  if (raw.size !== undefined) {
    const size = integer(raw.size, 16, 1024);
    if (size === undefined)
      return { ok: false, error: "size must be an integer between 16 and 1024" };
    options.size = size;
    canonical.size = String(size);
  }

  if (raw.tone !== undefined) {
    const tone = integer(raw.tone, 0, 100);
    if (tone === undefined)
      return { ok: false, error: "tone must be an integer between 0 and 100" };
    // The URL speaks 0–100 to stay in integers (a float param would make the
    // cache key space unbounded); the library speaks 0–1.
    options.tone = tone / 100;
    canonical.tone = String(tone);
  }

  return { ok: true, options, canonical };
}
