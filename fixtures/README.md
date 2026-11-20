# Cross-language reference fixtures

`blobatar-v2.4.0.json` is the language-neutral generation-2 reference artifact
for native Blobatar ports. It was generated from the pinned TypeScript release
by `tools/export-reference-vectors.ts` and is consumed read-only by both the
Swift and the Dart/Flutter tests. There is exactly one copy.

Do not update it from a port implementation. Regeneration must name a pinned
upstream source, preserve explicit comparison rules, and be reviewed as a
source-of-truth change separately from the port code that consumes it.
Regenerating on another platform may change the last digit of some
trig-derived floats; `meta.comparisonRules` already tolerates that.
