# blobatar-cli

Deterministic geometric blobatars from any string, in your terminal. No JS
project required — designers, CI pipelines, shell scripts, database seeds:

```sh
npx blobatar-cli alain > alain.svg     # or: bunx blobatar-cli alain
```

Installed globally, it answers to just `blobatar`:

```sh
npm i -g blobatar-cli                  # or: bun add -g blobatar-cli
blobatar alain
```

## Usage

```
blobatar <name>                          SVG to stdout
blobatar <name> -o alain.svg             to a file; format from the extension
blobatar <name> -o alain.png --size 512
blobatar <name> --background circle --hue 210 --tone 0.4 --expression happy
blobatar --stdin -d ./blobatars/         batch: one name per line on stdin
```

The flags are the endpoint's URL params — not merely compatible: both surfaces
parse through one shared table, so `--tone 0.4` and `?tone=0.4` are the same
sentence, with the same values, the same ranges and the same error messages.
Knowledge transfers between a URL and a terminal in both directions:

| Flag | Values | Default | Notes |
|---|---|---|---|
| `--size` | number `8`–`1024`, clamped | PNG: `256` · SVG: none | On SVG it only emits `width`/`height` attributes. On PNG it is the raster width in pixels. Out-of-range values clamp rather than error — the wrong scale is fixable, a broken render is not — and a non-numeric value is ignored, exactly as the endpoint ignores it. |
| `--background` | `squircle` · `circle` · `square` · `none` | `none` | `none` is transparent — the library's own default. |
| `--hue` | number `0`–`360` | — | Locks the hue in degrees; the name keeps driving everything else. A full turn lands on `360`, which is admitted. |
| `--tone` | number `0`–`1` | — | Locks the tone as a position across the swatch set. |
| `--expression` | `idle` · `happy` · `sad` · `mad` · `surprised` · `wink` · `sleepy` · `smug` · `unsure` · `scared` · `love` · `shy` · `sick` · `thinking` | `idle` | A static pose. |
| `--gen` | `1` · `2` | `2` | Pins a generation — one frozen seed→look mapping. Pinned output never changes; see below. |
| `--title` | text, ≤ 128 chars | — | The accessible name carried in the markup. |
| `--no-normalize` | — | — | Keeps the name's case and spacing. Names are otherwise normalized (NFC, trimmed, lowercased) so `Alain` and `alain` are one blobatar; for case-sensitive ids that normalization silently collides distinct ids — this flag is the fix. A URL has no spelling of this: it is the one flag the endpoint does not share. |

## Output rules

SVG goes to stdout by default, so the CLI composes with pipes and redirects.
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
names map to the same file — or to files differing only by case, which the
default macOS and Windows volumes would merge — the whole batch aborts with an
error listing them, and nothing is partially written. An exact duplicate line is the same
blobatar twice, so it is simply deduped, not a collision.

## Determinism, in CI

Same input, same bytes: SVG output is byte-identical for the same name, flags
and generation. `--gen` names a generation explicitly and a generation is
frozen by definition, so pinned output can never change under you. Without
`--gen`, renders follow the current default generation and move only when a
library major moves it — package majors select generations. PNG is visually
identical, but its bytes are tied to the resvg version in your lockfile — an
honest split worth knowing before you diff.

The pattern that follows: generate your team's blobatars in the build, commit
them, and pin the generation so diffs stay clean on your schedule, not the
library's.

```sh
blobatar --stdin -d assets/blobatars/ --gen 2 < team.txt
git diff --exit-code assets/blobatars/   # fails the build if a face changed
```

## Runtime

Node ≥ 18 or bun. The published package is plain JS with exactly three runtime
dependencies: `blobatar` (the renderer), `blobatar-v1` (the frozen v1 major
under an alias, so `--gen 1` renders the real thing), and `@resvg/resvg-js`
(PNG via native prebuilds — per-platform `optionalDependencies`, no postinstall
scripts). The CLI never talks to the network, and the endpoint never runs this
code: they are parallel consumers of one library and one shared param table.
