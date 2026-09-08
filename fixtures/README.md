# Cross-language reference fixtures

`blobatar-v2.4.0.json` is the language-neutral generation-2 reference artifact
for native Blobatar ports. Its bytes were generated from the pinned TypeScript
release and are consumed read-only by the Swift tests.

The Flutter SDK is developed as a separate workstream and currently keeps its
own checked-in copy. When that worktree is present, the Swift harness verifies
the two files are byte-identical. Relocating the Dart fixture belongs to the
Flutter workstream rather than to the Swift port.

Do not update either fixture from a port implementation. Regeneration must name
a pinned upstream source, preserve explicit comparison rules, and be reviewed
as a source-of-truth change separately from the port code that consumes it.
