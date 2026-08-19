# A package may be private when every consumer bundles it

CONTEXT.md defines a Package as a publishable workspace member, and until now
that was the whole truth: `packages/` held `blobatar` alone. `render-core`
breaks the pattern — it is the endpoint's param table extracted so the CLI can
parse through the very same code — and this records why the break is an
exception granted rather than the rule eroding.

## The alternative was publishing it, and publishing it is worse

A shared table has to live somewhere all its consumers can reach. Publishing
`render-core` to npm would do that, and would also make its every identifier a
public API with its own semver, its own deprecation story and its own
squatting-prone name — for a package whose entire audience lives in this
repo. A table nobody outside can depend on is one that can rename a
function in an afternoon. The cost of publishing is permanence, and nothing
here wants it.

The other alternative — each surface keeping its own copy — is the one the
extraction exists to kill: two tables that agree today diverge the first time
either surface grows a param, and the divergence is invisible until a caller
types the same value into both and gets two answers.

## What "private" costs, and how each consumer pays

A package that is never published has no installable name, so every consumer
must bundle it from source:

- **The CLI** (`packages/cli`) declares it a workspace devDependency and its
  build inlines it into the distributed bin. The published tarball carries the
  table's code, not a dependency on it.
- **The endpoint** (`apps/api`) imports it by relative path — the same
  mechanism, for the same reason, as the site's Worker importing the endpoint
  itself (ADR-0005): the standalone clone the Deploy to Cloudflare button
  makes installs `apps/api` alone, where a workspace protocol would not
  resolve, but the file is in every clone and wrangler bundles it from there.
- **The endpoint film** (`apps/video`) imports it the same way, for its
  honesty rule: the blobatar on screen must come from the parser the URL
  would actually hit.

CONTEXT.md's rule that an App consumes `blobatar` through its public `exports`
map is untouched: that rule exists so development runs against the surface a
consumer installs, and `render-core` has no installed surface — its source is
its surface, for everyone, identically.

## Consequences

- The glossary's Package entry names the exception and points here.
- `render-core` stays out of every public `exports` map, every README install
  instruction and npm entirely. If something outside this repo ever needs the
  table, that is a new decision about a public package, not a loosening of
  this one.
- Its `version` field stays `0.0.0`: packing a consumer resolves workspace
  ranges, and an unversioned member fails the pack. The number is plumbing,
  not a release.
