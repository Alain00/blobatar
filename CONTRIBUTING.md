# Contributing

Thanks for being here. This is a small library with a few strong opinions, and
most of them are written down — in [`CONTEXT.md`](./CONTEXT.md) for the
vocabulary, in [`docs/adr/`](./docs/adr) for the decisions, and in comments
above the scripts that enforce them. Reading the first two before a substantial
change will save you more time than it costs.

## Getting set up

```sh
bun install          # bun, not npm — the repo is a Bun workspace
bun run dev          # the tuning grid (apps/demo)
bun run site         # the landing page (apps/site)
bun run api          # the endpoint (apps/api), builds the library first
bun run test         # the library's suite
bun run check        # everything CI runs, or close to it
```

The apps alias `blobatar/*` back to `packages/blobatar/src` through tsconfig
paths, so editing a curve shows up in the tuning grid on save. `apps/api` is the
deliberate exception: it resolves the library through its published `exports`
map, which is why `bun run api` builds the package first.

Install a Chrome and a Firefox if you don't have them. One check needs a real
browser — see below.

## The layout

- `packages/blobatar` — the library.
- `packages/cli` — the terminal surface, published as `blobatar-cli`.
- `packages/render-core` — the endpoint's param table, shared with the CLI.
  Private and never published; every consumer bundles it (ADR-0009).
- `apps/site` — the landing page, and the deployable that puts the endpoint on
  blobatar.dev.
- `apps/api` — the endpoint, `GET /avatar/<name>`, also deployable on its own.
- `apps/demo` — the tuning grid: blobatars in aggregate, so numeric ranges can
  be judged as clusters and outliers rather than one seed at a time.
- `apps/video` — the Remotion films used for the README and release media.
- `docs/adr` — the decisions, with their reasoning. Kept as written even when
  later work supersedes them; a decision record that quietly changes is worth
  nothing.

## The gate

`bun run check` inside `packages/blobatar` runs, in order: typecheck, tests,
size budgets, the composition probe, the build, and a Node smoke test against
the built package. CI runs the same list plus the apps, so a green local `check`
is meant to predict a green CI. If you find a gap between them, that gap is the
bug — fix it there rather than working around it.

Two of those deserve a note:

**The composition probe** (`bun run probe`) bundles the real source, loads it in
headless Chrome and measures pixels. It exists because the two failures that
shipped — eyes deforming on the wrong axis, and a morph that never ran — live in
the gap between what the renderer emits and what a CSS engine does with it, and
nothing in a string can see across that gap. It warns and exits 0 when it finds
no browser, so a local run without one is not a hard stop; CI asserts both
engines are present first.

**Size budgets** (`bun run size`) are measured through synthetic consumers, per
entry point. The core budget is the one that matters: it is what stops a
convenience import from quietly pulling in an adapter. If your change needs a
budget raised, raise it in the same commit and say in the comment what those
bytes bought — every existing bump does.

## The things that are not yours to change casually

**The golden fixture.** `test/golden/gen2.txt` pins the seed → look mapping. A
diff there is a breaking change, not a test to update, and `scripts/golden.ts`
refuses to run without `--write` for exactly that reason. If a threshold moves
and the golden test goes red, fix the code. If the move is genuinely intended,
it belongs in a new generation, not in a regenerated fixture.

**Generations.** The mapping — silhouette vocabulary, band thresholds, every
numeric range, the tone set — is frozen per generation, and the package major
selects one. Adding a silhouette is not additive: a new band takes its mass from
its neighbours, so existing users' blobatars become somebody else's. See
[ADR-0006](./docs/adr/0006-generations.md) and
[ADR-0008](./docs/adr/0008-package-majors-select-generations.md).

**Adapter neutrality.** An adapter owns the outer element and adds nothing else
— no geometry, no vocabulary, no defaults of its own. Two adapters given the
same name and options render the same blobatar, and an option the caller leaves
out reaches the library left out. A framework supplying its own default for an
unset prop is an adapter inventing an answer nobody gave.

**The vocabulary.** `CONTEXT.md` is the glossary, including the words to avoid
and why. Public API says *name*; internals say *seed*. If your change needs a
new term, add it there in the same PR.

## Commits and pull requests

Conventional-commit subjects (`feat:`, `fix:`, `chore:`, `docs:`), written in
the imperative and describing the effect rather than the edit — "stop the Vue
adapter injecting options", not "update vue.ts". Subject line only: no body, no
trailers.

For a pull request, say what changed and — if it touches the library — whether
it moves the seed → look mapping. That question is the one a reviewer here cares
about most, because the answer decides whether the change is a patch, a minor,
or a new generation.

If your change is user-visible, add a `CHANGELOG.md` entry in the same PR. The
changelog leads with churn: releases that move the mapping say so first, and
releases that don't say *that* plainly too.

## Releasing

Publishing is manual and tag-driven. Bump `packages/blobatar/package.json`,
write the changelog entry, tag `vX.Y.Z` and push the tag — `release.yml` refuses
to publish a tag that disagrees with `package.json`, publishes through npm's
trusted publisher with provenance, and takes no npm token. Renaming that
workflow file breaks the trust relationship, so don't.

blobatar.dev deploys separately, on push to main, and only when the site, the
endpoint or the library changed. A Worker can be rolled back in seconds; an npm
version cannot be unpublished after 72 hours. The asymmetry in how they ship is
the asymmetry in how reversible they are.

## Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). Issues,
pull requests and reviews are all covered by it, and reports go to the address
named there.

## Licence

By contributing you agree that your contributions are licensed under the
[MIT licence](./LICENSE) that covers this project.
