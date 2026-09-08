# Changelog

All notable changes to the native Swift SDK are documented here. Blobatar's
JavaScript packages keep their release history in the repository root.

## 2.8.0

The first official native Swift release.

- Add the UI-independent `BlobatarCore` product with generation-2
  normalization, hashing, traits, palette, geometry, expressions, and seeded
  elapsed-time motion.
- Add the `BlobatarSwiftUI` product with native `Canvas` rendering, static and
  animated views, accessibility labels, pointer hover, Reduce Motion support,
  scene-aware pausing, and application-controlled off-screen activity.
- Add Blobatar Studio for iOS and macOS, a clean external-consumer smoke
  package, DocC catalogs, and minimum/current Xcode CI coverage.
- Document exact parity evidence and the deliberate SVG, raster, Unicode,
  platform, hover, and interactive-gaze boundaries.

The Swift SDK reads the canonical TypeScript `2.4.0` generation-2 fixtures.
This release adds native APIs and rendering without changing the seed-to-look
mapping.
