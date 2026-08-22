---
"@blobatar/react": minor
"@blobatar/vue": minor
"@blobatar/solid": minor
"@blobatar/preact": minor
"@blobatar/svelte": minor
"blobatar": minor
---

Adds `travel` and animated-only depth cues. See
`packages/blobatar/docs/3d-directional-motion-plan.md`.

**`travel`** moves the whole blobatar across its frame along one cardinal
direction — `"ltr"`, `"rtl"`, `"ttb"`, `"btt"` — or lets the name pick with
`"seeded"`. It requires `animate` (a static `<img>` cannot move) and
`import "blobatar/motion.css"`, is honored by the framework adapters only, and
is deliberately not hover-gated: opting in per render is the gate. Reduced
motion removes it outright; on touch devices it is removed rather than paused so
no blobatar is ever caught transparent at a wrap edge.

**Depth cues** ship in the animated inline-SVG path only: a ground-shadow
ellipse that stays put while the creature bobs over it, and a face sheen under
the eyes. Static output is byte-identical to the previous release — goldens are
frozen per major, and this is a minor. The two rendering modes now differ in
drawing as well as motion; CONTEXT.md's *Rendering mode* entry says so.
