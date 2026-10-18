# Parity and Platform Boundaries

Understand what the native port matches exactly and where platform behavior is
intentionally different.

## Generation contract

The Swift core consumes the repository's read-only TypeScript `2.4.0`
generation-2 fixture. Normalized names, hashes, keyed trait streams, rounded
path commands, colors, expression channels, and seeded motion values are
covered by cross-runtime tests. All ten silhouettes, four backdrops, and
fourteen expressions are represented.

Adding the Swift package does not introduce a new generator generation. A name
and equivalent options retain their established seed-to-look result.

## Numeric behavior

Swift and JavaScript both use IEEE 754 binary floating-point values, but the
standard does not require their trigonometric libraries to return bit-identical
results. Tests therefore use a narrow `1e-9` relative tolerance for raw
trigonometric layout values. Hashes, traits, rounded path strings, hexadecimal
colors, and expression channels remain exact.

## Unicode behavior

The public normalization option applies NFC normalization, trimming, and
lowercasing. Swift and JavaScript can lowercase uncommon Unicode scalars
differently even when normalization agrees. The checked-in international
vectors define the supported cross-runtime contract; changing it requires new
upstream vectors rather than a platform-only correction.

## Rendering behavior

`BlobatarCore` returns structured paths instead of SVG text. The SwiftUI
product converts those commands to native paths and paints them with `Canvas`.
Core Graphics and browser SVG engines can antialias edge pixels differently;
geometry, transform order, color, and draw order are the parity contract.

Use the TypeScript package when an integration specifically requires serialized
SVG or a data URI.

## Interaction behavior

Pointer hover is a presentation policy owned by the SwiftUI product and is
available only when the host platform supplies pointer hover. Seeded ambient
motion remains deterministic on touch platforms through the always-on policy.

Interactive pointer gaze is not part of this release. The existing `gaze.x`
and `gaze.y` traits place generated eyes at rest; they do not expose a live gaze
controller. Gaze remains the optional post-release interaction layer.
