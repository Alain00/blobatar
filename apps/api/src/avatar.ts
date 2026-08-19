import { blobatar as blobatar2 } from "blobatar/blob";
import { blobatar as blobatar1 } from "blobatar-v1/blob";
// By path rather than through node_modules, the same way the site's Worker
// imports this file: `render-core` is private and never published, so there is
// no installable name for the standalone clone the Deploy button makes — but
// the file is in every clone, and both wrangler and bun bundle it from here.
import {
  BadRequest,
  parseName,
  parseOptions,
  type Generation,
  type UrlOptions,
} from "../../../packages/render-core/src";

/**
 * What both generations can render.
 *
 * Typed over the URL's option surface rather than over either library's, since
 * the two are separate packages and only have to agree on what this endpoint
 * passes. See `UrlOptions`.
 */
type Renderer = (name: string, options?: UrlOptions) => string;

const RENDERERS: Record<Generation, Renderer> = {
  1: blobatar1,
  2: blobatar2,
};

/** The one public path. Everything outside it is the site. */
export const PREFIX = "/avatar/";

/**
 * A day, then a month of serving stale while revalidating.
 *
 * The instinct for deterministic output is `immutable, max-age=31536000`, and
 * that is where this should end up — it is also the only lever that reduces
 * billed requests, since a Worker is charged per request whether it hits a
 * cache or not, so the caches that save money are the ones downstream.
 *
 * It is wrong *today*. The library guarantees determinism within a major
 * version, and at 0.x a major is a minor: the shape thresholds and tone set are
 * frozen per major precisely because changing them reshuffles every existing
 * blobatar. A year-long immutable cache would outlive that guarantee and leave
 * a reshuffle half-applied across the internet for a year, with no purge
 * possible on caches we do not own.
 *
 * `stale-while-revalidate` buys most of the win without the exposure: a repeat
 * viewer is served instantly from cache for a month while the revalidation
 * happens off the critical path.
 */
const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=2592000";

/**
 * A year, immutable — for a URL that named its generation.
 *
 * This is the precondition the comment above spent a paragraph wanting: a
 * generation is frozen by definition, so `?gen=1` cannot come back different
 * later. A reshuffle becomes a new URL rather than a new answer at an old one,
 * which is the only thing that makes an unpurgeable year-long cache safe.
 *
 * ADR-0004 predicted this arriving as `/avatar/v1/<name>`. A query parameter
 * gets the same property — the generation is in the cache key either way —
 * without putting a reserved namespace in front of user-supplied names. See
 * ADR-0006.
 *
 * Worth having beyond the caching: it is the only lever that reduces *billed*
 * requests, since a Worker is charged whether it hits an edge cache or not. The
 * caches that save money are the ones downstream, and this is what lets them
 * hold on.
 */
const PINNED = "public, max-age=31536000, immutable";

/**
 * SVG is an active document format, and this one is served from the same origin
 * as the site.
 *
 * The markup carries no script, no external reference and no element ids, and
 * the single caller-supplied value (`title`) is escaped by the renderer. These
 * headers are the belt to that braces: `default-src 'none'` means a future
 * injection has nothing to reach for, and `nosniff` stops a browser deciding
 * this is HTML on its own initiative.
 *
 * Scoped to this route rather than applied site-wide — the landing page needs
 * its own styles and scripts, and a `default-src 'none'` over the whole origin
 * would blank it.
 */
const SECURITY = {
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "x-content-type-options": "nosniff",
} as const;

const USAGE = `blobatar — deterministic avatars over HTTP

  GET /avatar/<name>

A name is anything that stands for somebody: a username, an email, an id,
a Gravatar hash. The same name always renders the same blobatar.

Parameters (all optional, named as the library names them):

  size, s     8-1024, clamped rather than rejected
  background  none | square | circle | squircle
  hue         0-360 degrees, locks colour so the name drives shape only
  tone        0-1 position in the swatch set
  expression  idle | happy | sad | mad | surprised | wink | sleepy
              | smug | unsure | scared | love | shy | sick | thinking
  title       accessible name, 128 characters or fewer
  gen         1 | 2 — which shape vocabulary to render under, see below

Examples:

  /avatar/alain00
  /avatar/alain%40example.com?size=64
  /avatar/team-rocket?background=squircle&expression=smug

Pinning a generation
--------------------
A generation is one frozen name-to-blobatar mapping. Adding a shape is not
additive — a new silhouette has to take its share from the existing ones —
so new shapes arrive as a new generation rather than as a change to yours.

  /avatar/alain00?gen=1     round organic boxy nub cloud sun
  /avatar/alain00?gen=2     …and capsule triangle hexagon droplet

An unversioned URL follows the current major and now renders gen 2. Existing
URLs that must retain their old shapes should pin ?gen=1 before upgrading.

A generation that has appeared in a URL keeps answering. The list only ever
grows — a pinned generation is never retired, redirected to a newer
vocabulary, or answered with a placeholder. That is also why a pinned URL is
served with a year-long immutable cache rather than a day: it cannot come
back different, so every cache between here and your reader is free to keep
it.

Replacing Gravatar
------------------
Swap the host and keep the rest of the URL:

  https://www.gravatar.com/avatar/<hash>?s=200&d=identicon
  https://blobatar.dev/avatar/<hash>?s=200&d=identicon

d, f and r are accepted and ignored — every string renders, so there is
no missing avatar to fall back to and nothing above a G rating to filter.
Code using d=404 to detect "this user has no Gravatar" now gets a 200.

The hash is used as the name. Gravatar's digest is one-way, so the email
cannot be recovered — but the digest is itself derived from the email, so
each person still gets one stable distinct blobatar. It will not be the
same one /avatar/<email> gives: pick one scheme per application.

To keep real Gravatars and use blobatar only for people without one, pass
this endpoint as Gravatar's own fallback instead:

  https://www.gravatar.com/avatar/<hash>?d=<url-encoded blobatar url>

Names are NFC-normalized, trimmed and lowercased before hashing, so
/avatar/Alain and /avatar/alain render the same blobatar from different
URLs. Prefer one spelling: each is cached separately by every cache in
the path.

https://github.com/Alain00/blobatar
`;

/**
 * FNV-1a over the rendered markup.
 *
 * A body hash rather than a hash of the inputs, so the tag cannot claim two
 * renders match when a library upgrade has changed what they produce. 32 bits
 * is ample for revalidating one URL against its own past: a collision needs two
 * different bodies at the same URL, and the consequence is one stale render
 * until the `max-age` above expires rather than anything durable.
 *
 * Hand-rolled because the alternative in a Worker is `crypto.subtle.digest`,
 * which is async and would make the whole handler async to compute a checksum
 * over 700 bytes.
 */
function etag(body: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `"${(h >>> 0).toString(36)}"`;
}

const text = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Errors and help are the one thing here that is not deterministic across
      // deploys — a new parameter changes both. Kept out of caches so a fix
      // takes effect when it ships.
      "cache-control": "no-store",
      ...SECURITY,
    },
  });

/**
 * The help text, as a response.
 *
 * Exported because a standalone deploy has no site behind it. `apps/api` serves
 * this at `/` and at every path it does not recognise; `apps/site` serves the
 * landing page there instead, and only ever reaches `avatar` below.
 */
export const usage = (status = 200) => text(USAGE, status);

/**
 * The endpoint, as a function of one Request.
 *
 * Deliberately free of Workers-specific APIs — no `caches.default`, no `env`,
 * no `ctx`. That is not portability for its own sake; it is what lets the whole
 * thing be tested under `bun test` with no mocking and no runtime, which is the
 * same bargain the rest of the repo makes.
 *
 * The Cache API is the notable omission. It saves CPU on a hit, and CPU is the
 * one resource already free here: generation measures 12µs, against 30M CPU-ms
 * included per month — about 300M requests' worth. It does not save a single
 * billed request, because a Worker is charged per request either way. So a
 * cache lookup would add a round trip to the colo's store in front of work that
 * is faster than the lookup, to save nothing. `Cache-Control` above is the part
 * that actually pays.
 */
export function avatar(request: Request): Response {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(`${request.method} not allowed`, {
      status: 405,
      headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8", ...SECURITY },
    });
  }

  const url = new URL(request.url);
  // `/avatar/` with nothing after it is the one place the docs can live now
  // that the site owns `/`.
  if (url.pathname === PREFIX) return text(USAGE, 200);

  let body: string;
  try {
    const { generation, options } = parseOptions(url.searchParams);
    body = RENDERERS[generation](parseName(url.pathname, PREFIX), options);
  } catch (e) {
    if (e instanceof BadRequest) return text(`${e.message}\n\n${USAGE}`, 400);
    throw e;
  }

  const tag = etag(body);
  const headers = {
    "content-type": "image/svg+xml; charset=utf-8",
    // Read off the raw query rather than off the parsed options, because the
    // question is whether the *caller* pinned a generation, not which one they
    // ended up with. An unversioned URL resolves to gen2 too, and it must not
    // inherit the cache of a promise it never asked for.
    "cache-control": url.searchParams.has("gen") ? PINNED : CACHE_CONTROL,
    etag: tag,
    // Anyone may embed one. An avatar endpoint that could not be read
    // cross-origin would have no purpose.
    "access-control-allow-origin": "*",
    ...SECURITY,
  };

  // Answered here rather than left to the platform, since the body is already
  // in hand and the comparison is a string equality.
  if (request.headers.get("if-none-match") === tag) {
    return new Response(null, { status: 304, headers });
  }

  // `null` for HEAD: a body on a HEAD response is a protocol error, and
  // constructing one only to have the runtime drop it is a coin flip on which
  // runtime you are in.
  return new Response(request.method === "HEAD" ? null : body, { headers });
}
