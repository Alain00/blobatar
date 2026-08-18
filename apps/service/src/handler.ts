/**
 * The whole service, as one pure function: every branch lives here, behind
 * injected capabilities, so `bun test` covers it without workerd. The entry
 * (`entry.ts`) wires the real runtime and holds no logic of its own.
 */
import type { BlobatarOptions } from "blobatar";
import { normalizeSeed } from "blobatar";
import {
  PARAM_NAMES,
  PNG_DEFAULT_SIZE,
  parseParams,
  type ParamName,
  type RawParams,
} from "render-core";

export interface WorkerCache {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
}

export interface HandlerDeps {
  cache: WorkerCache;
  /** Runs a promise past the response's lifetime — `ctx.waitUntil` in workerd. */
  waitUntil(promise: Promise<unknown>): void;
  /** `blobatar()` — the service treats its output as opaque bytes. */
  render(name: string, options: BlobatarOptions): string;
  /** SVG markup to PNG bytes at a pixel width. */
  rasterize(svg: string, size: number): Promise<Uint8Array<ArrayBuffer>>;
}

/**
 * A single URL-encoded path segment, then the format. The router matches on
 * path only — the hostname never participates, so the Worker can be mounted
 * anywhere.
 */
const ROUTE = /^\/v1\/([^/]+)\.(svg|png)$/;

/**
 * The canonical cache key's synthetic origin. Fixed and never the request's
 * host: every hostname this Worker is mounted on shares one render cache, and
 * a future identity layer can read the real hostname without fragmenting it.
 */
const CACHE_ORIGIN = "https://blobatar.cache";

const CACHEABLE = "public, max-age=31536000, immutable";

const USAGE = "blobatar: GET /v1/:name.svg or GET /v1/:name.png?size=256";

/** Every non-image response: plain text, never cached. */
function plain(status: number, body: string, headers?: Record<string, string>): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export async function handleRequest(request: Request, deps: HandlerDeps): Promise<Response> {
  // HEAD rides the GET path untouched: the runtime strips the body.
  if (request.method !== "GET" && request.method !== "HEAD")
    return plain(405, "method not allowed", { Allow: "GET, HEAD" });

  const url = new URL(request.url);
  const match = ROUTE.exec(url.pathname);
  if (!match) return plain(404, USAGE);

  let name: string;
  try {
    name = decodeURIComponent(match[1]!);
  } catch {
    return plain(400, "name is not valid percent-encoding");
  }
  if (name.length > 256) return plain(400, "name must be at most 256 characters");
  const format = match[2] as "svg" | "png";

  // The allowlist, applied: anything else on the query string — utm noise,
  // future params like `key` — is ignored and never reaches the cache key.
  const raw: RawParams = {};
  for (const param of PARAM_NAMES) {
    const value = url.searchParams.get(param);
    if (value !== null) raw[param] = value;
  }
  const parsed = parseParams(raw);
  if (!parsed.ok) return plain(400, parsed.error);

  // The name as the library will hash it — the identity the cache keys on.
  const seed = parsed.options.normalize === false ? name : normalizeSeed(name);
  if (seed === "") return plain(400, "name must not be empty");

  const key = cacheKey(seed, format, parsed.canonical);
  const hit = await deps.cache.match(key);
  if (hit) return hit;

  const response =
    format === "svg"
      ? svgResponse(deps.render(name, parsed.options))
      : await pngResponse(deps, name, parsed.options);

  deps.waitUntil(deps.cache.put(key, response.clone()));
  return response;
}

/**
 * The canonical key: synthetic origin, the name as the library will hash it,
 * and only the params that change bytes — sorted, canonicalized, and stripped
 * when byte-equivalent to their absence. `/v1/Alain.svg`, `/v1/alain.svg` and
 * `/v1/alain.svg?normalize=true&utm_source=x` are one entry, not three.
 */
function cacheKey(
  seed: string,
  format: string,
  canonical: Partial<Record<ParamName, string>>,
): string {
  const keyed = { ...canonical };
  if (keyed.expression === "idle") delete keyed.expression;
  if (keyed.normalize === "true") delete keyed.normalize;
  if (keyed.background === "none") delete keyed.background;
  if (format === "png" && keyed.size === String(PNG_DEFAULT_SIZE)) delete keyed.size;

  const query = PARAM_NAMES.filter((p) => keyed[p] !== undefined)
    .map((p) => `${p}=${keyed[p]}`)
    .join("&");
  return `${CACHE_ORIGIN}/v1/${encodeURIComponent(seed)}.${format}${query ? `?${query}` : ""}`;
}

function svgResponse(markup: string): Response {
  return new Response(markup, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": CACHEABLE,
      // An SVG opened as a document must not be able to run anything. blobatar
      // markup is hygienic; this is defense in depth for a hotlinkable host.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function pngResponse(
  deps: HandlerDeps,
  name: string,
  options: BlobatarOptions,
): Promise<Response> {
  // The raster width comes from `fitTo`, so a width/height attribute in the
  // source SVG would be dead weight: render without it.
  const { size, ...rest } = options;
  const bytes = await deps.rasterize(deps.render(name, rest), size ?? PNG_DEFAULT_SIZE);
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": CACHEABLE,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
