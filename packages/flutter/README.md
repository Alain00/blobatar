# blobatar for Dart and Flutter

Deterministic geometric blobatars from any string. This is the official
Dart/Flutter port of [blobatar](https://blobatar.dev), maintained in the
upstream monorepo with the same frozen generation-2 seed-to-look contract.

The same name and options always produce the same avatar. The port renders
directly with Dart and Flutter Canvas primitives; it does not wrap browser SVG
markup or a web view.

## Install

```sh
flutter pub add blobatar
```

The package exposes two libraries:

- `package:blobatar/blobatar.dart` contains deterministic normalization,
  hashing, traits, palette, geometry, expressions, and elapsed-time motion. It
  imports neither Flutter nor `dart:ui`.
- `package:blobatar/flutter.dart` adds static and animated Flutter widgets,
  painters, and Canvas renderers, and re-exports the common core values.

The published package requires the Flutter SDK because it ships both layers;
applications that only need calculations can import the core library without
pulling Flutter types into their source.

## Static Widget

```dart
import 'package:blobatar/flutter.dart';

Blobatar(
  name: user.email,
  size: 64,
  semanticLabel: 'Avatar of ${user.displayName}',
  options: const BlobatarOptions(
    background: Backdrop.squircle,
    expression: happy,
  ),
)
```

`size` pins a square edge. Without it, the widget expands to its constraints
and centers the generation-2 100-by-100 view box inside the largest square.
`semanticLabel` labels the image for assistive technology.

## Animated Widget

```dart
AnimatedBlobatar(
  name: user.email,
  size: 120,
  animation: BlobatarAnimation.always,
  options: const BlobatarOptions(expression: thinking),
)

AnimatedBlobatar(
  name: user.email,
  animation: BlobatarAnimation.hover,
)
```

`BlobatarAnimation.always` runs seeded breathe, bob, blink, and saccade motion
continuously. `BlobatarAnimation.hover` ramps ambient motion and lift in while
a pointer is over the widget; it stays idle in non-interacted lists. Expression
changes morph with the upstream timing and easing, including held `thinking`
seesaw and `mad` tremor loops.

Set `active: false` when an application knows a widget is off-screen. The
widget also follows `TickerMode`, disposes every controller with its state, and
uses the static rendering path when `MediaQuery.disableAnimations` requests
reduced motion. Set `respectReducedMotion: false` only when the application
provides an equivalent accessibility control.

## Options

Options are immutable and forwarded to the core without adapter-specific
defaults:

```dart
BlobatarOptions(
  background: Backdrop.circle,
  hue: 210,
  tone: 0.8,
  palette: const {'eye': '#ffffff'},
  traits: const {
    'shape': 0.99,
    'eye.ratio': 0,
  },
  normalize: true,
  contrast: true,
  expression: love,
)
```

| Option | Dart value | Behavior |
| --- | --- | --- |
| `background` | `Backdrop.none`, `.squircle`, `.circle`, `.square` | Draws the matching backdrop plate. |
| `backgroundColor` | `#rgb` or `#rrggbb` | Fills the backdrop; needs a `background`. Keeps the contrast floors, unlike `palette['bg']`. |
| `hue` | degrees | Pins color while the name continues to drive other traits. |
| `tone` | `0 <= value < 1` | Selects an authored lightness/chroma band. |
| `palette` | `Map<String, String>` | Overrides selected `bg`, `head`, or `eye` colors. |
| `traits` | `Map<String, Object>` | Pins hash-space trait positions; omitted traits remain name-driven. |
| `normalize` | `bool` | Applies NFC, trim, and lowercase when true. |
| `contrast` | `bool` | Enforces the generation-2 contrast floors when true. |
| `expression` | `Expression` | Applies one of the fourteen generation-2 poses and optional tint. |

All expression values are exported from either library: `idle`, `happy`,
`sad`, `mad`, `surprised`, `wink`, `sleepy`, `smug`, `unsure`, `scared`,
`love`, `shy`, `sick`, and `thinking`.

## Core API

```dart
import 'package:blobatar/blobatar.dart';

final traits = traitsFor('alain@example.com');
final layout = layoutFor('alain@example.com');
final colors = ramp(210);
final frame = motionAt(
  motionSeedsFor('alain@example.com'),
  1200,
  1,
);
```

- `traitsFor` exposes the deterministic trait reader.
- `layoutFor`, `partsFor`, and `resolve` expose resolved generation-2 output.
- `ramp` and `palette` expose the authored OKLCh palette pipeline.
- `superellipse`, `blobPath`, and `polygon` expose structured path primitives.
- `motionSeedsFor` and `motionAt` expose deterministic motion without a
  Flutter controller.

## Parity

The port is pinned to blobatar `2.4.0`, generation 2. That package major owns
the frozen seed-to-look mapping, so adding this SDK does **not** move any
existing name to a different avatar and does not modify the TypeScript golden
fixture.

`../../fixtures/blobatar-v2.4.0.json` is a checked-in, self-describing,
repository-only artifact exported once from the TypeScript implementation by
`../../tools/export-reference-vectors.ts` and shared with the Swift port. It contains 1,570 layout cases,
42 expression cases, every silhouette band, normalization and non-ASCII
inputs, palette/tone edges, and trait overrides. The Dart tests only read it;
they never update it from port output, and `test/` is excluded from the
published package archive.

| Area | Status | Evidence or boundary |
| --- | --- | --- |
| NFC + trim + lowercase | Supported | Hash vectors include precomposed/decomposed Latin, mixed case, CJK, emoji, Greek, and Arabic. |
| Hash and trait streams | Exact | Integer states and stream doubles compare directly to the fixture. |
| Ten generation-2 silhouettes | Supported | Structured path strings are exact; frame/face/eye containment is swept over thousands of names. |
| OKLCh palette and contrast | Supported | Serialized hex values are exact across hue/tone and override vectors. |
| Four backdrops | Supported | Static and animated raster tests cover plate ordering and isolation. |
| Fourteen expressions | Supported | Pose/tint vectors and extreme-geometry tests cover every expression. |
| Breathe, bob, blink, saccades | Supported | Seeded periods/phases and selected elapsed frames match TypeScript calculations. |
| Hover and always motion | Supported | Flutter widget tests cover activation ramps, continuity, reuse, and disposal. |
| Secondary-eye saccade wrap | Supported | Canvas composition and raster tests verify foreshortening on both eyes. |
| Pointer gaze API | Not included | Gaze was added after the pinned `2.4.0` contract and requires a separate interaction model. |
| SVG/string output | Not included | Flutter renders native Canvas paths; use the TypeScript package for SVG markup or data URIs. |

### Known Rendering Differences

- Dart VM trigonometric functions call the host C math library. IEEE 754 does
  not require one bit-exact `sin`/`cos` implementation, so trig-derived layout
  floats use the fixture's tight `1e-9` relative tolerance. Rounded path data,
  hash values, traits, palette hex, and expression channels remain exact.
- Flutter and browser engines rasterize vector edges with different
  antialiasing implementations. Geometry and draw order match; individual edge
  pixels are not promised to match an SVG browser screenshot.
- NFC is provided by `unorm_dart`. The parity fixture covers the normalization
  cases that affect the upstream paste-a-name contract; a future Unicode data
  update must be checked against new upstream vectors before changing output.

## Supported Platforms

| Platform | Static | Animated | Notes |
| --- | --- | --- | --- |
| Android | Yes | Yes | Use `always` for touch-first ambient motion. |
| iOS | Yes | Yes | Use `always` for touch-first ambient motion. |
| Web | Yes | Yes | Supports both `hover` and `always`. |
| macOS | Yes | Yes | Supports both `hover` and `always`. |
| Windows | Yes | Yes | Supports both `hover` and `always`. |
| Linux | Yes | Yes | Supports both `hover` and `always`. |

The supported SDK floor is Dart 3.6 / Flutter 3.27. CI checks the minimum
Flutter 3.27 line and the latest stable Flutter 3.x release.

## Example

`example/` is an interactive Blobatar Studio for changing the name, shape,
expression, hue, backdrop, and motion mode. It also demonstrates held
expression loops, a hover-animated gallery, reduced continuous list work, and
the fixed Claude/Codex web easter eggs.

```sh
cd packages/flutter/example
flutter pub get
flutter run -d chrome
```

See [`example/README.md`](example/README.md) for device and test commands.

## Development

```sh
cd packages/flutter
flutter pub get
dart format --output=none --set-exit-if-changed .
dart analyze
dart test test/dart
flutter test test/flutter
dart doc

cd example
flutter pub get
flutter analyze
flutter test
```

Regenerate the reference artifact only from a checkout of the pinned upstream
release, never from this Dart implementation:

```sh
BLOBATAR_TS_SRC=/path/to/blobatar-v2.4.0/packages/blobatar/src \
  bun ../../tools/export-reference-vectors.ts
```

## License and Maintenance

MIT licensed, matching the upstream project. Blobatar was created by Alain;
the Dart/Flutter implementation is maintained by 404khai with upstream
approval. The `blobatar` pub.dev name was approved in
[Alain00/blobatar#29](https://github.com/Alain00/blobatar/issues/29). Publishing
remains manual and is not performed by this repository's npm release workflow.
