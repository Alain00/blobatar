# blobatar service

Blobatars by URL. Paste an `<img>` tag and somebody has a face — no install,
no JS toolchain, no build step:

```html
<img src="https://<host>/v1/alain.svg" width="48" alt="alain" />
<img src="https://<host>/v1/alain.png?size=128&expression=happy" alt="alain" />
```

A Cloudflare Worker (`apps/service`) serving the library over HTTP. Same
determinism contract: the same name always answers with the same bytes, which
is what lets every response be cached immutably at the edge — after the first
request for a name+params combination, rendering never runs again.

## Routes

```
GET /v1/:name.svg
GET /v1/:name.png
```

`:name` is one URL-encoded path segment — up to 256 characters, decoded.
`HEAD` works everywhere `GET` does. Everything else is a 404 with a usage
hint, or a 405.

## Params

| Param | Values | Default | Notes |
|---|---|---|---|
| `size` | integer `16`–`1024` | PNG: `256` · SVG: none | On SVG it only emits `width`/`height` attributes — omit it and CSS sizes the image (the library's own design). On PNG it is the raster width in pixels. |
| `background` | `squircle` · `circle` · `square` · `none` | `none` | `none` is transparent — the library's own default. |
| `hue` | integer `0`–`360` | — | Locks the hue in degrees; the name keeps driving everything else. |
| `tone` | integer `0`–`100` | — | Locks the tone as a position in the swatch set (the library's 0–1, in URL-friendly integers). |
| `expression` | `happy` · `sad` · `mad` · `idle` | `idle` | A static pose. `idle` is byte-identical to omitting the param. |
| `normalize` | `true` · `false` | `true` | See [Names, ids and privacy](#names-ids-and-privacy). |

Invalid values of known params are a plain-text `400`, before any rendering.
Unknown params are ignored — pasted URLs that accumulate `utm_*` junk keep
working and never fragment the cache.

The `key` param is **reserved for future use**. Today it is ignored like any
other unknown param; don't use it for your own purposes.

### What is deliberately not a param

- **`palette`** — overridden colors bypass the library's verified-contrast
  guarantee, and the service must not serve what the library does not
  guarantee. Lock `hue` and `tone` instead.
- **`traits`** — an unbounded trait surface cannot be frozen contract.
  Account-level trait pinning is future work, not a query param.
- **`animate`** — animated blobatars are inline SVG whose idle motion gates on
  the host page's hover; inside a remote `<img>` that channel does not exist.
- **`title`** — accessibility text belongs to your `<img alt>`, not inside the
  served SVG; arbitrary query text is also an injection and cache-pollution
  surface.

## Names, ids and privacy

Prefer stable ids over personal data. If the natural name is an email, hash it
client-side — `sha256(email)` is still deterministic, so it is still the same
face everywhere (a different face than the raw email would give, but stable):
raw emails in URLs end up in logs, caches and browser history. This is the
same trade-off Gravatar settled with hashes.

Names are normalized like the library normalizes them — NFC, trimmed,
lowercased — so `Alain` and `alain` are one blobatar. If your names are
case-sensitive ids (nanoid, base64), pass `normalize=false` or distinct ids
will silently collide into one face.

The served SVG carries no `<title>`: the accessible name of the image is your
`<img alt>`.

## Caching and `/v1`

Responses are `Cache-Control: public, max-age=31536000, immutable`. Every
response is cached under a canonical key — param order, default-equivalent
params, name casing and the serving hostname never duplicate entries.

`/v1/` is the library's determinism contract translated to URLs: it pins the
current visual contract (the 0.1 line). Any visually-breaking library release
— whatever its semver — mounts a new `/vN` while `/v1` keeps serving what it
always served. A blobatar embedded anywhere never changes face retroactively.
The deployed Worker pins an exact library version; bumping it within a visual
contract is safe by the library's structural-stability guarantee.

## Development

```sh
cd apps/service
bun run dev     # builds the library, then wrangler dev
```

wrangler needs **Node ≥ 22** on the machine, even when launched through bun.
The library must be built first because wrangler bundles workspace deps
through their real `exports` maps, and blobatar's points at `dist/` — `bun run
dev` does both. No Cloudflare account is needed locally.

Tests are `bun test` — the whole service is a pure handler with injected
capabilities (cache, `waitUntil`, render, rasterize), so every branch runs
without workerd. The Cloudflare entry (`src/entry.ts`) is deliberately
branch-free wiring, covered by running `wrangler dev`. Param-table
correctness is `render-core`'s suite; rendering correctness is the library's.
Programmatic Miniflare v4 does run under `bun test` (de-facto support, not
documented by Cloudflare) and is the recorded future option if real-workerd
integration tests ever earn their place.

Deploys go to the project's Cloudflare account (`bun run deploy`, maintainer
only). The Worker is hostname-agnostic — the public hostname is a deploy-time
routing choice, never code.
