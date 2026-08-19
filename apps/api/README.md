# blobatar over HTTP

One Cloudflare Worker, one route:

```
GET /avatar/<name>
```

`<name>` is anything that stands for somebody — a username, an email, an id, a
Gravatar hash — and the same name always renders the same blobatar. Parameters
are named as the library names them (`size`/`s`, `background`, `hue`, `tone`,
`expression`, `title`), and Gravatar's `d`, `f` and `r` are accepted and
ignored so that an existing Gravatar URL works by changing the host alone.

`GET /avatar/` returns the full parameter list; so does any other path, with a
404.

## Deploy your own

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Alain00/blobatar/tree/main/apps/api)

The button clones this directory into your Git account, deploys it to yours,
and hands back `https://blobatar-api.<your-subdomain>.workers.dev`. Every push
to your clone redeploys it. To attach your own hostname, add it in the
dashboard under Workers → your Worker → Domains & Routes, or as a `routes`
entry in `wrangler.jsonc`.

By hand, if you would rather:

```sh
bun install
bunx wrangler deploy
```

## What it costs

Nothing, at any traffic a normal application produces. The Workers free plan
allows 100,000 requests a day and 10ms of CPU per request; rendering a blobatar
measures 12µs and the response is 357 bytes gzipped. There is no database, no
bucket and no bound resource of any kind — the avatar is a pure function of the
URL, which is what lets `Cache-Control` push most of the traffic off this Worker
and into caches nobody pays for.

## Development

Run from the repository root, so the library is built first:

```sh
bun api      # wrangler dev → localhost:8787/avatar/alain
```

Then the tests, which need that same build:

```sh
bun --filter blobatar build
bun --filter blobatar-api test
```

Unlike `apps/site` and `apps/demo`, this app has no `blobatar/*` tsconfig
aliases to the library source. It resolves the package the way a fresh clone
does — through `exports`, at the version in `package.json` — because that is
what anyone pressing the button will run.

## Relationship to `apps/site`

`avatar.ts` here is the endpoint — its param table lives in
`packages/render-core`, shared with the CLI — and `apps/site` imports it
rather than holding a copy: blobatar.dev serves this Worker with the landing
page attached, and `run_worker_first` scopes it to `/avatar/*` there. The two
deployments differ only in what happens off that path — the site, or the help
text above. See [ADR-0005](../../docs/adr/0005-the-endpoint-is-its-own-deployable.md).
