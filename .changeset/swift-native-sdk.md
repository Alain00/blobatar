---
"blobatar": minor
---

Ship the official native Swift SDK with pure generation-2 resolution,
SwiftUI static and animated views, iOS and macOS Blobatar Studio, DocC
documentation, parity evidence, and minimum/current Xcode release gates.

Swift Package Manager resolves versions from this repository's `v*` tags, so
this lockstep minor is the first version Swift consumers can depend on. The
SDK consumes the existing TypeScript 2.4.0 fixtures and supports
`backgroundColor`. This release does not change the generation-2 seed-to-look
mapping for any platform.
