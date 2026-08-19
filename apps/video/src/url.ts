/**
 * The endpoint film: the script it types, and the clock derived from it.
 *
 * The tweet this is cut for makes one claim — *the URL is the product* — so the
 * film has exactly one moving part. A URL line is edited on screen and the
 * blobatar above it is whatever that URL returns. Nothing else animates, there
 * are no cuts, and the frame never moves.
 *
 * Two rules keep it honest, and both are load-bearing rather than decorative:
 *
 * 1. **The blobatar is rendered from the URL, by the endpoint's own parser.**
 *    `render` below runs `parseName`/`parseOptions` out of the shared table in
 *    `packages/render-core` — the same functions the Worker calls — and hands
 *    the result to `blobatar()`. The markup on screen is byte-for-byte the
 *    response body, so a frame cannot show a face the URL does not produce —
 *    including the ones nobody would think to fake, like `?s=2` clamping up to
 *    8 rather than erroring.
 *
 * 2. **The blobatar is static.** The endpoint serves a bare SVG: no stylesheet
 *    travels with it, and `blobatar()` returns static markup regardless of
 *    `animate` (see `render.ts`). So this film imports neither `motion.css` nor
 *    `seek.css`, and there is no clock to seek — which is the difference
 *    between it and the other two compositions, and the truth about what the
 *    URL gives you. Motion is the library's, and the card says so.
 */

import { blobatar } from "blobatar/blob";
import { parseName, parseOptions } from "../../../packages/render-core/src";
import { PREFIX } from "../../api/src/avatar";

import { FPS, HEIGHT, WIDTH } from "./timeline";

export { FPS, HEIGHT, WIDTH } from "./timeline";

/** The host the film is about. Everything else on screen is somebody else's. */
export const HOST = "blobatar.dev";

/**
 * md5("alain00@acme.com").
 *
 * A real digest of the address typed two steps earlier, rather than 32 random
 * hex characters, because the Gravatar beat later swaps the host in front of
 * this exact string — and a viewer who checks is the viewer worth having.
 * `scripts/check-endpoint.ts` recomputes it.
 */
export const HASH = "3abf15c83ca7156f66ea560e0b0d10aa";

/**
 * How a step reaches its URL.
 *
 * `type` — the default — is the diff: delete back to the common prefix with the
 * previous URL, then type the rest. That covers appending a parameter, editing
 * a value, and retyping a name, which is nearly the whole film.
 *
 * `paste` replaces the line at once. Used for the strings nobody types — a
 * 32-character digest, a uuid, a Gravatar URL out of somebody's codebase —
 * where forty frames of character-by-character typing buys nothing and costs
 * the pacing.
 *
 * `swap` replaces in place, left to right, at equal length. It exists for one
 * step: `gravatar.com` → `blobatar.dev`. The two hosts are the same length and
 * differ only in `grav`/`blob` and `com`/`dev`, so the drop-in can be shown
 * rather than asserted — the hash, the `?s=200` and the `&d=identicon` visibly
 * never move.
 */
export type Mode = "type" | "paste" | "swap";

export type Step = {
  /** The URL after this commit, without a scheme. */
  readonly url: string;
  /** The line under it. Carried forward until another step states a new one. */
  readonly note?: string;
  /** Frames held after the commit, before the next step starts editing. */
  readonly hold: number;
  readonly mode?: Mode;
};

/**
 * The script.
 *
 * Ordered as the thread is: what a name can be, then the parameters, then the
 * Gravatar drop-in. Each beat is a claim in the tweet and nothing here is a
 * beat the tweet does not make.
 */
export const SCRIPT: readonly Step[] = [
  { url: `${HOST}/avatar/alain00`, note: "any string is a name", hold: 42 },
  { url: `${HOST}/avatar/alain00@acme.com`, note: "an email", hold: 28 },
  { url: `${HOST}/avatar/${HASH}`, note: "a gravatar hash", hold: 28, mode: "paste" },
  {
    url: `${HOST}/avatar/018f34c1-9a20-4e0f-8e3f-6b1d2c7a55e1`,
    note: "an id",
    hold: 30,
    mode: "paste",
  },
  { url: `${HOST}/avatar/alain00`, note: "same name, same face, forever", hold: 34 },

  // The size staircase, one digit at a time. Three real URLs rather than one
  // typed slowly: the image on screen is always a committed request, and `s=2`
  // committing as an 8px blobatar is the clamp doing exactly what it documents.
  { url: `${HOST}/avatar/alain00?s=2`, note: "everything is a query param", hold: 14 },
  { url: `${HOST}/avatar/alain00?s=20`, hold: 14 },
  { url: `${HOST}/avatar/alain00?s=200`, hold: 16 },
  { url: `${HOST}/avatar/alain00?s=512`, note: "svg — any size", hold: 26 },

  { url: `${HOST}/avatar/alain00?s=512&expression=smug`, note: "13 expressions", hold: 26 },
  { url: `${HOST}/avatar/alain00?s=512&expression=wink`, hold: 26 },

  {
    url: `${HOST}/avatar/alain00?s=512&expression=wink&background=squircle`,
    note: "4 backgrounds",
    hold: 24,
  },
  { url: `${HOST}/avatar/alain00?s=512&expression=wink&background=circle`, hold: 24 },

  // 150 rather than the 210 the thread quotes: `alain00` hashes to hue 236 on
  // its own, and a demo that pins a colour 26° from where the name already put
  // it is a parameter apparently doing nothing. Checked, not eyeballed —
  // `check-endpoint.ts` holds the gap open against the name's own hue.
  {
    url: `${HOST}/avatar/alain00?s=512&expression=wink&background=circle&hue=1`,
    note: "hue pins the colour — the name still drives the shape",
    hold: 12,
  },
  { url: `${HOST}/avatar/alain00?s=512&expression=wink&background=circle&hue=15`, hold: 12 },
  { url: `${HOST}/avatar/alain00?s=512&expression=wink&background=circle&hue=150`, hold: 32 },

  {
    url: `gravatar.com/avatar/${HASH}?s=200&d=identicon`,
    note: "a gravatar url",
    hold: 34,
    mode: "paste",
  },
  {
    url: `${HOST}/avatar/${HASH}?s=200&d=identicon`,
    note: "swap the host, keep the url — d, f and r are accepted and ignored",
    hold: 46,
    mode: "swap",
  },

  // Back to the line the film opened on, which is also the line in the tweet.
  // The card is measured on this URL, so the number it prints is the number for
  // the request on screen — see `scripts/check-endpoint.ts`.
  { url: `${HOST}/avatar/alain00`, note: "one url, any string", hold: 30 },
];

/** Frames per character. Deleting is faster than typing, as it is in a hand. */
const TYPE = 2;
const DEL = 1;
/** A paste is one motion; these frames are the eye catching up, not the paste. */
const PASTE = 8;
/** The host swap, end to end. Slow enough to read `grav` becoming `blob`. */
const SWAP = 20;

/** How long the card holds after the last step, and the whole film's length. */
const CARD_HOLD = 96;

const commonPrefix = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};

export type Beat = {
  readonly step: Step;
  /** Frame the edit begins on. */
  readonly from: number;
  /** Frame the URL is whole again — the request, and the new blobatar. */
  readonly commit: number;
  /** Frame the next step starts editing. */
  readonly to: number;
  /** Where this step's change begins, as an index into its URL. */
  readonly at: number;
  readonly prev: string;
};

/**
 * The script with a clock on it.
 *
 * Every frame number in the film is derived here rather than written down. A
 * timeline of hand-placed beats is fine when the beats are camera moves, which
 * is what `timeline.ts` has; this film's beats are *strings*, and their cost is
 * a function of their length — so adding one parameter to one URL would silently
 * push every later beat out of the hold it was tuned for.
 */
export const BEATS: readonly Beat[] = (() => {
  const out: Beat[] = [];
  let prev = "";
  let from = 24;
  for (const step of SCRIPT) {
    const mode = step.mode ?? "type";
    const at = mode === "swap" ? 0 : commonPrefix(prev, step.url);
    const cost =
      mode === "paste"
        ? PASTE
        : mode === "swap"
          ? SWAP
          : (prev.length - at) * DEL + (step.url.length - at) * TYPE;
    const commit = from + cost;
    const to = commit + step.hold;
    out.push({ step, from, commit, to, at, prev });
    prev = step.url;
    from = to;
  }
  return out;
})();

export const LAST = BEATS[BEATS.length - 1]!;
export const B_CARD = LAST.to;
export const END = B_CARD + CARD_HOLD;

/** The film's state on a frame: what the line reads, and what it committed. */
export type Frame = {
  /** The characters on screen. */
  readonly text: string;
  /** Index from which the text is lit. Everything before it is settled. */
  readonly lit: number;
  /** The last committed URL, or `""` before the first one exists. */
  readonly url: string;
};

const beatAt = (frame: number): Beat => {
  for (const b of BEATS) if (frame < b.to) return b;
  return LAST;
};

/** One past the last index at which two equal-length lines differ. */
const diffEnd = (a: string, b: string) => {
  for (let i = Math.min(a.length, b.length) - 1; i >= 0; i--) if (a[i] !== b[i]) return i + 1;
  return 0;
};

/**
 * A swap's text part-way through: the new line's head on the old line's tail.
 *
 * Both are the same length by construction — `check-endpoint.ts` refuses a swap
 * where they are not — so the line does not move by a pixel while the host
 * changes underneath it.
 *
 * The walk runs to the last *differing* character rather than to the end of the
 * line. Past that point the two strings are identical and nothing would be seen
 * to happen, which on a 42-character URL whose last 30 characters are the same
 * hash and query would be three quarters of the beat spent on a still frame.
 */
const swapped = (prev: string, url: string, t: number) => {
  const n = Math.round(diffEnd(prev, url) * t);
  return url.slice(0, n) + prev.slice(n);
};

export function frameAt(frame: number): Frame {
  const b = beatAt(frame);
  const i = BEATS.indexOf(b);
  const committed = frame >= b.commit ? b.step.url : i > 0 ? BEATS[i - 1]!.step.url : "";
  const mode = b.step.mode ?? "type";

  if (frame >= b.commit) return { text: b.step.url, lit: b.at, url: committed };

  if (mode === "paste") return { text: b.prev, lit: b.prev.length, url: committed };

  if (mode === "swap") {
    const text = swapped(b.prev, b.step.url, (frame - b.from) / SWAP);
    // The image arrives the instant the host reads `blobatar.dev`, not when the
    // beat ends: the line on screen *is* the request, and the last characters of
    // the swap change nothing about it. This is the one place the committed URL
    // is read off the visible text rather than off the step.
    return { text, lit: 0, url: text.startsWith(`${HOST}/`) ? text : committed };
  }

  // Deleting back to the common prefix, then typing the tail.
  const del = (b.prev.length - b.at) * DEL;
  if (frame < b.from + del) {
    const gone = Math.floor((frame - b.from) / DEL);
    return { text: b.prev.slice(0, b.prev.length - gone), lit: b.prev.length, url: committed };
  }
  const typed = Math.floor((frame - b.from - del) / TYPE);
  return {
    text: b.step.url.slice(0, b.at + typed),
    lit: b.at,
    url: committed,
  };
}

/**
 * The note under the line, and the frames it changes on.
 *
 * A step without a note keeps the one above it — the size staircase is three
 * URLs making one point, and re-stating it three times would read as three.
 */
export type Note = { readonly text: string; readonly from: number; readonly to: number };

export const NOTES: readonly Note[] = (() => {
  const out: Note[] = [];
  for (const b of BEATS) {
    const text = b.step.note;
    if (!text) continue;
    if (out.length) out[out.length - 1] = { ...out[out.length - 1]!, to: b.from };
    out.push({ text, from: b.from, to: B_CARD });
  }
  return out;
})();

/**
 * The response, as the endpoint would write it.
 *
 * Returns `null` for a URL this endpoint does not serve, which happens on
 * exactly one step: the Gravatar line. The film shows an empty slot there
 * rather than inventing what somebody else's host would return.
 */
export function render(url: string): string | null {
  if (!url.startsWith(`${HOST}/`)) return null;
  const u = new URL(`https://${url}`);
  // `parseOptions` returns the endpoint's whole request — `{ generation,
  // options }` — not a `BlobatarOptions`. Passing the wrapper straight to
  // `blobatar` type-checks against an all-optional options bag and silently
  // renders defaults, so every URL in the film draws the same blobatar and
  // every beat claiming a parameter does something is a beat where nothing
  // happens. The film renders whatever generation this package major is, which
  // is why only `options` is taken here.
  return blobatar(parseName(u.pathname, PREFIX), parseOptions(u.searchParams).options);
}

/** The size the URL asks for, or `null` when it leaves it to CSS. */
export function sizeOf(url: string): number | null {
  if (!url.startsWith(`${HOST}/`)) return null;
  const u = new URL(`https://${url}`);
  return parseOptions(u.searchParams).options.size ?? null;
}

/** What CSS sizes an SVG to when the URL does not. The film's stylesheet. */
export const CSS_SIZE = 320;

/** Where the film puts things. */
export const BLOB_Y = 400;
export const LINE_X = 110;
export const LINE_Y = 792;
export const NOTE_Y = 872;

const ms = (frame: number) => (frame / FPS) * 1000;
export const seconds = ms(END) / 1000;

/**
 * Kept honest, at module load: every step is a URL the endpoint answers 200 to.
 *
 * `parseOptions` throws `BadRequest` on anything it does not serve, so a typo in
 * the script — `expresion=love`, `background=squircle ` with a trailing space —
 * fails the render instead of shipping a film that shows a URL returning an
 * image it would actually 400 on. That is the one lie this film cannot tell.
 */
for (const b of BEATS) {
  if (b.step.url.startsWith(`${HOST}/`)) render(b.step.url);
}

/** And a swap has to be a swap: same length, or the line moves under the eye. */
for (const b of BEATS) {
  if (b.step.mode === "swap" && b.prev.length !== b.step.url.length) {
    throw new Error(`swap changes length: ${b.prev} → ${b.step.url}`);
  }
}
