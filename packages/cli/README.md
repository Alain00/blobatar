# blobatar-cli

Deterministic geometric blobatars from any string, in your terminal. No JS
project required — designers, CI pipelines, shell scripts, database seeds:

```sh
npx blobatar-cli alain > alain.svg     # or: bunx blobatar-cli alain
```

Install it globally and the command is just `blobatar`:

```sh
npm i -g blobatar-cli                  # or: bun add -g blobatar-cli
blobatar alain
```

## Usage

```
blobatar <name>                          SVG to stdout
blobatar <name> -o alain.svg             to a file; format from the extension
blobatar <name> -o alain.png --size 512
blobatar <name> --background circle --hue 210 --tone 40 --expression happy
blobatar --stdin -d ./blobatars/         batch: one name per line on stdin
```

The flags mirror the blobatar service's `/v1` URL params exactly — same names,
same values, same validation, same error messages — so knowledge transfers
between the two in both directions:

| Flag | Values | Default | Notes |
|---|---|---|---|
| `--size` | integer `16`–`1024` | PNG: `256` · SVG: none | On SVG it only emits `width`/`height` attributes. On PNG it is the raster width in pixels. |
| `--background` | `squircle` · `circle` · `square` · `none` | `none` | `none` is transparent — the library's own default. |
| `--hue` | integer `0`–`360` | — | Locks the hue in degrees; the name keeps driving everything else. |
| `--tone` | integer `0`–`100` | — | Locks the tone as a position in the swatch set. |
| `--expression` | `happy` · `sad` · `mad` · `idle` | `idle` | A static pose. |
| `--no-normalize` | — | — | Keeps the name's case and spacing. Names are otherwise normalized (NFC, trimmed, lowercased) so `Alain` and `alain` are one blobatar; for case-sensitive ids that normalization silently collides distinct ids — this flag is the fix. |

## Output rules

SVG goes to stdout by default, so the tool composes with pipes and redirects.
PNG is binary and never lands on a TTY: write it with `-o file.png`, or pipe
stdout together with `--format png`. With `-o` the extension decides the
format, and a contradicting `--format` is an error. Errors go to stderr —
stdout carries only image bytes — and the exit code is `0` on success, `1` on
any failure.

## Batch

```sh
cut -d, -f1 users.csv | blobatar --stdin -d ./blobatars/ --format png
```

One name per line, trimmed, empty lines skipped. Each file is named by a
deterministic sanitization of the name — the same normalization the render
applies, then anything outside `[A-Za-z0-9._-]` becomes `_`, capped at 200
characters. Every filename is computed before anything is written: if two
names map to the same file, the whole batch aborts with an error listing them,
and nothing is partially written. An exact duplicate line is the same
blobatar twice, so it is simply deduped, not a collision.

## Determinism, in CI

Same input, same bytes: SVG output is byte-identical for the same name and
flags within a visual-contract major of the library (this package's major
tracks it). PNG is visually identical, but its bytes are tied to the resvg
version in your lockfile — an honest split worth knowing before you diff.

The pattern that follows: generate your team's blobatars in the build, commit
them, and diffs stay clean until a visual major.

```sh
blobatar --stdin -d assets/blobatars/ < team.txt
git diff --exit-code assets/blobatars/   # fails the build if a face changed
```

## Runtime

Node ≥ 18 or bun. The published package is plain JS with exactly two runtime
dependencies: `blobatar` (the renderer) and `@resvg/resvg-js` (PNG via native
prebuilds — per-platform `optionalDependencies`, no postinstall scripts). The
CLI never talks to the network, and the blobatar service never runs this code:
they are parallel consumers of the same library.
