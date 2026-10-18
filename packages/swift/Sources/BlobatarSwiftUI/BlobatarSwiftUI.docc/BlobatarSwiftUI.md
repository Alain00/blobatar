# ``BlobatarSwiftUI``

Render deterministic Blobatars as native static or animated SwiftUI views.

## Overview

`BlobatarSwiftUI` converts `BlobatarCore` drawing commands to native SwiftUI
paths and paints them in a `Canvas`. It does not run JavaScript, parse generated
SVG, or embed a web view.

Use ``Blobatar`` when the figure is static:

```swift
import BlobatarCore
import BlobatarSwiftUI

Blobatar(
  name: user.email,
  size: 72,
  options: BlobatarOptions(
    background: .circle,
    expression: .happy
  ),
  accessibilityLabel: "Avatar of \(user.displayName)"
)
```

Use ``AnimatedBlobatar`` for seeded ambient motion and expression morphs:

```swift
AnimatedBlobatar(
  name: user.email,
  size: 120,
  options: BlobatarOptions(expression: .thinking),
  animation: .always,
  active: isOnScreen,
  accessibilityLabel: "Avatar of \(user.displayName)"
)
```

The complete installation, option, parity, and platform tables are in the
Swift package README.

## Topics

### Static rendering

- ``Blobatar``

### Animated rendering

- ``AnimatedBlobatar``
- <doc:AnimationAndLifecycle>
