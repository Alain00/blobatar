/**
 * render-core — the endpoint's param table, shared by every string surface.
 *
 * A URL and a terminal spell blobatars the same way: `?tone=0.4&expression=shy`
 * and `--tone 0.4 --expression shy` must be one vocabulary, one set of ranges
 * and one set of error messages, or `tone=0.4` quietly means two different
 * things depending on where it was typed. This package is that vocabulary made
 * once: `apps/api` parses its query strings through it, and `blobatar-cli`
 * feeds its flags through the same functions, so the two surfaces cannot
 * drift a param apart without a test noticing.
 *
 * It contains nothing else — no rasterization, no cache logic, no I/O. Private
 * and never published: wrangler bundles it into the Worker and the CLI build
 * inlines it into the distributed bin (see each consumer's config for how).
 */
import type { BlobatarOptions } from "blobatar/blob";
import type { Expression } from "blobatar/expression";
import {
  happy, idle, love, mad, sad, scared, shy, sick, sleepy, smug, surprised, thinking,
  unsure, wink,
} from "blobatar/expression";

/** A caller error, carrying the text served as the 400 body. */
export class BadRequest extends Error {}

/**
 * The whole roster, by name.
 *
 * Expressions are values rather than strings in the library so that a consumer
 * ships only the poses it uses (ADR-0002). A server is the one consumer that
 * uses all of them by definition, so the mapping the library declines to make
 * gets made here — once, explicitly, rather than by indexing the namespace,
 * which would also expose `poseVars` and `bakePose` as if they were poses.
 */
const EXPRESSIONS: Record<string, Expression> = {
  idle, happy, sad, mad, surprised, wink, sleepy, smug, unsure, scared, love, shy, sick,
  thinking,
};

/**
 * The generations, by the number a URL spells them with.
 *
 * Every generation the deployed library carries, listed for the same reason
 * `EXPRESSIONS` is: a server is the one consumer that uses all of them by
 * definition, so the mapping the library declines to make gets made here.
 *
 * The entries only ever grow. A generation that appeared in a URL has to keep
 * answering — that is the entire promise `?gen=` makes, and removing one would
 * break it more thoroughly than never having offered it.
 */
export type Generation = 1 | 2;

const GENERATIONS: Record<string, Generation> = {
  1: 1,
  2: 2,
};

/**
 * The option surface a URL can state.
 *
 * Deliberately a subset of `BlobatarOptions` rather than the whole of it, and
 * the reason is `avatar.ts`: one `Renderer` type has to accept both
 * generations, and they are two different packages whose option types agree on
 * everything a URL can spell and are free to diverge on everything it cannot.
 * `traits` is where that became concrete — gen2 takes a list where gen1 takes
 * a number — and a query string states neither, so naming the six parameters
 * this endpoint actually parses is both the honest contract and the one that
 * keeps a library change from looking like an endpoint break.
 */
export type UrlOptions = Pick<
  BlobatarOptions,
  "size" | "background" | "hue" | "tone" | "expression" | "title"
>;

export interface RenderRequest {
  generation: Generation;
  options: UrlOptions;
}

/**
 * Backgrounds, including the spelling `false` has in a URL.
 *
 * `none` rather than `false` because a query string has no booleans, and
 * `background=false` reads like a mistake in a URL a human is writing by hand.
 */
const BACKGROUNDS: Record<string, UrlOptions["background"]> = {
  none: false,
  square: "square",
  circle: "circle",
  squircle: "squircle",
};

/**
 * Long enough for any real key, short enough that the URL cannot be used as
 * storage. RFC 5321 caps an email at 254 characters, a UUID is 36 and a
 * Gravatar SHA-256 is 64. Nothing legitimate addressing a person needs more.
 */
export const MAX_NAME = 256;

/** `title` lands in the accessible name, where a paragraph is already wrong. */
const MAX_TITLE = 128;

/**
 * The markup is byte-identical at every size — `size` only emits `width` and
 * `height` over a fixed viewBox — so these bound legibility, not cost.
 */
export const MIN_SIZE = 8;
export const MAX_SIZE = 1024;

/**
 * Gravatar's own vocabulary: accepted, and doing nothing.
 *
 * `d`/`default` names the image to fall back to when an address has no avatar,
 * and there is no such case here — every string renders. `f`/`forcedefault`
 * asks for that fallback unconditionally, which is already what happens.
 * `r`/`rating` filters by content rating, and two capsules on a soft body are
 * G-rated by construction.
 *
 * Named individually rather than swept up by a blanket ignore-unknowns rule.
 * That distinction is the whole design of this parser: a parameter Gravatar
 * documents is one a real URL may carry, so it must not fail; a parameter
 * nobody documents is a typo, and `?expresion=happy` rendering a perfectly
 * valid blobatar wearing the wrong face is a bug the caller cannot see.
 */
const IGNORED = ["d", "default", "f", "forcedefault", "r", "rating"];

const KNOWN = ["s", "size", "background", "hue", "tone", "expression", "title", "gen", ...IGNORED];

function number(raw: string, key: string, min: number, max: number): number {
  const n = Number(raw);
  // `Number("")` is 0 and `Number(" 12 ")` is 12, neither of which anyone meant
  // to write. Checking the parse this way also rejects `NaN` and both infinities.
  if (raw.trim() === "" || !Number.isFinite(n)) {
    throw new BadRequest(`${key} must be a number, got "${raw}"`);
  }
  if (n < min || n > max) throw new BadRequest(`${key} must be between ${min} and ${max}, got ${n}`);
  return n;
}

function oneOf<T>(raw: string, key: string, table: Record<string, T>): T {
  // An own-property check rather than a truthy lookup or `in`: `background=none`
  // maps to `false`, which truthiness would reject, and a plain object answers
  // `in` truthily for `__proto__` and `constructor` — neither of which is an
  // entry, and both of which would flow downstream as one.
  if (!Object.hasOwn(table, raw)) {
    throw new BadRequest(`unknown ${key} "${raw}" — expected one of ${Object.keys(table).join(", ")}`);
  }
  return table[raw]!;
}

/**
 * The query string as renderer options.
 *
 * One dialect, because there is one route. Parameters are named as the library
 * names them, so a URL reads as the call it makes, and Gravatar's are accepted
 * alongside them so that moving an integration here is a host edit and nothing
 * more.
 *
 * `traits` and `palette` are deliberately absent. `traits` is a sparse map of
 * 0–1 positions whose keys follow the layout and are explicitly not enumerated
 * as a public list, and `palette` bypasses the contrast guarantee by design —
 * an endpoint anyone can link is the wrong place to hand out either. Both stay
 * available to anyone importing the library, which is where they belong.
 */
export function parseOptions(params: URLSearchParams): RenderRequest {
  for (const key of params.keys()) {
    if (!KNOWN.includes(key)) {
      throw new BadRequest(`unknown parameter "${key}" — expected one of ${KNOWN.join(", ")}`);
    }
  }

  const opts: UrlOptions = {};
  // `s` first: Gravatar accepts both and documents `s` as the canonical short
  // form, so it wins when a URL somehow carries the pair.
  const size = params.get("s") ?? params.get("size");
  const background = params.get("background");
  const hue = params.get("hue");
  const tone = params.get("tone");
  const expression = params.get("expression");
  const title = params.get("title");
  const gen = params.get("gen");

  if (size !== null) {
    /*
     * Clamped, where every other parameter here is validated.
     *
     * Gravatar permits sizes up to 2048 and real URLs carry it, so rejecting
     * out-of-range would break the drop-in on its most common parameter. The
     * asymmetry is defensible beyond that compatibility, though: size is the
     * one parameter that cannot make the answer *wrong*. A clamped `s=2048`
     * is the right blobatar at the wrong scale, which CSS can fix; a 400 is a
     * broken image, which nothing can.
     */
    const n = Number(size.trim() === "" ? NaN : size);
    if (Number.isFinite(n)) opts.size = Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, n)));
  }
  const generation = gen === null ? 2 : oneOf(gen, "gen", GENERATIONS);
  if (background !== null) opts.background = oneOf(background, "background", BACKGROUNDS);
  // 360 is admitted alongside 0 rather than excluded as a duplicate: hue is a
  // circle, callers compute into it, and rejecting the value that a full turn
  // lands on would be a trap. The library takes it modulo.
  if (hue !== null) opts.hue = number(hue, "hue", 0, 360);
  // Clamped just inside the top edge: the library's tone buckets are half-open
  // (`v < edge`), so an exact 1 matches no bucket and falls back to the first
  // swatch — tone=1 rendering byte-identically to tone=0. Held fractionally
  // under 1, the documented range ends where a caller expects: in the last
  // swatch. Both generations bucket the same way, so the clamp covers each.
  if (tone !== null) opts.tone = Math.min(number(tone, "tone", 0, 1), 0.999999);
  if (expression !== null) opts.expression = oneOf(expression, "expression", EXPRESSIONS);
  if (title !== null) {
    if (title.length > MAX_TITLE) {
      throw new BadRequest(`title must be ${MAX_TITLE} characters or fewer, got ${title.length}`);
    }
    opts.title = title;
  }
  return { generation, options: opts };
}

/** Everything a Gravatar URL may end in. Recognised, then discarded. */
const EXTENSIONS = [".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp"];

/**
 * The name out of `/avatar/<name>`, with any image extension removed.
 *
 * A name and a Gravatar digest are the same thing to this endpoint: a seed.
 * That is what makes one route serve both. Gravatar addresses a person by the
 * MD5 or SHA-256 of their lowercased email, which is one-way — the address
 * cannot be recovered to hash again. It does not need to be: the digest is
 * itself a deterministic function of the email, so seeding from it yields
 * exactly the property that matters, one stable distinct blobatar per person.
 *
 * The consequence to know before relying on it: `/avatar/<md5 of alain@x.com>`
 * and `/avatar/alain@x.com` are two different blobatars for one human. They are
 * each stable, and neither can be derived from the other. Pick one addressing
 * scheme per application.
 *
 * The digest is not validated for shape. Gravatar has used MD5 and now
 * SHA-256, self-hosted implementations use others, and every one of them is
 * just a seed here — a hex check would buy nothing and break the next format.
 */
export function parseName(pathname: string, prefix: string): string {
  const raw = pathname.slice(prefix.length);
  if (raw.includes("/")) {
    throw new BadRequest(`expected ${prefix}<name> — a name containing a slash must be percent-encoded as %2F`);
  }
  const ext = EXTENSIONS.find(e => raw.toLowerCase().endsWith(e));
  const encoded = ext ? raw.slice(0, -ext.length) : raw;
  if (encoded === "") throw new BadRequest("name is empty");

  let name: string;
  try {
    name = decodeURIComponent(encoded);
  } catch {
    // `decodeURIComponent("%")` throws URIError. Reported as the caller error
    // it is, rather than escaping as a 500.
    throw new BadRequest("name is not valid percent-encoding");
  }

  // Measured after decoding, so the cap is on the name rather than on how
  // verbosely it was spelled: an emoji-heavy name triples in length encoded.
  if (name.length > MAX_NAME) {
    throw new BadRequest(`name must be ${MAX_NAME} characters or fewer, got ${name.length}`);
  }
  return name;
}
