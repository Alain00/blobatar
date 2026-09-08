# ``BlobatarCore``

Resolve a string into deterministic generation-2 Blobatar drawing data without
depending on a UI framework.

## Overview

`BlobatarCore` is the portable calculation layer for the native Swift SDK. It
normalizes and hashes a name, resolves keyed traits, derives an OKLCh palette,
composes one of ten silhouettes, applies one of fourteen expressions, and
returns immutable drawing commands for a renderer to consume.

The module is pinned to the canonical TypeScript `2.4.0` generation-2 fixture.
New Swift capabilities do not change that seed-to-look mapping.

```swift
import BlobatarCore

let drawing = resolveBlobatar(
  "alain@example.com",
  options: BlobatarOptions(
    background: .squircle,
    expression: .happy
  )
)
```

For animation, resolve the seeded motion once and evaluate it against a shared
monotonic elapsed-time clock. Do not accumulate frame-to-frame deltas.

```swift
let seeds = resolveBlobatarMotion("alain@example.com")
let frame = blobatarMotionFrame(
  seeds: seeds,
  elapsedMilliseconds: 1_200,
  amplitude: 1
)
```

## Topics

### Resolve a Blobatar

- ``resolveBlobatar(_:options:)``
- ``BlobatarOptions``
- ``BlobatarDrawing``
- ``BlobatarExpression``

### Resolve deterministic motion

- ``resolveBlobatarMotion(_:options:)``
- ``blobatarMotionFrame(seeds:elapsedMilliseconds:amplitude:shake:)``
- ``BlobatarMotionSeeds``
- ``BlobatarMotionFrame``

### Integration contract

- <doc:ParityAndPlatformBoundaries>
