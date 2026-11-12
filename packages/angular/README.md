# @blobatar/angular

Angular adapter for [blobatar](https://github.com/Alain00/blobatar) — deterministic
geometric avatars generated from any string. A standalone, signal-input component
for Angular 17.3 and later, SSR-safe.

## Installation

```sh
npm install @blobatar/angular blobatar
# or
bun add @blobatar/angular blobatar
```

`blobatar` is a peer dependency: the adapter carries no renderer of its own.

## Usage

```ts
import { Component } from "@angular/core";
import { Blobatar } from "@blobatar/angular";

@Component({
  selector: "app-user",
  imports: [Blobatar],
  template: `<blobatar [name]="user.email" [size]="48" />`,
})
export class UserComponent {
  user = { email: "user@example.com" };
}
```

The inputs are core's options, under the same names every adapter uses —
`name` (required), `size`, `background`, `backgroundColor`, `palette`, `defs`, `paint`, `hue`, `tone`, `traits`,
`normalize`, `contrast`, `title`, `expression`, `animate` — plus `alt` for the
static `<img>`. Full reference in the [main README](https://github.com/Alain00/blobatar#readme).

`class` and `style` written on `<blobatar>` land on the host element, which
wraps the `<img>` or `<svg>` the component renders.

## Animation and expressions

Animated blobatars render as inline SVG rather than an `<img>`, and need the
stylesheet in your global styles:

```css
@import "blobatar/motion.css";
```

```html
<blobatar [name]="user.email" animate="hover" />
<blobatar [name]="user.email" animate="always" [expression]="happy" />
```

Expressions are imported from core, so only the ones you use are bundled:

```ts
import { happy } from "blobatar/expression";
```

## Following the pointer

The eyes can track the cursor. That layer is the one part of the motion system
that needs JavaScript, so it is a separate entry point and costs nothing unless
you import it:

```ts
import { Blobatar } from "@blobatar/angular";
import { BlobatarGaze } from "@blobatar/angular/gaze";

@Component({
  imports: [Blobatar, BlobatarGaze],
  template: `<blobatar [name]="user.email" animate="always" gaze="pointer" [gazeTravel]="3" [size]="96" />`,
})
```

```css
@import "blobatar/motion.css";
@import "blobatar/gaze.css"; /* required — the eyes hold still without it */
```

`gazeTravel` is the excursion in viewBox units (about 1.5 to 4 reads well), and
it is what opts a blobatar into the layer: without it, or a CSS rule setting
`--mo-track-travel`, the driver runs and the eyes do not move.

`gaze` takes any target the core driver does — `"pointer"`, `"rest"`, an
element, a `{ x, y }` point, or `null`. A bare `gaze` attribute leaves the aiming
to you:

```html
<blobatar name="ori" animate="always" gaze [gazeTravel]="3" #g="blobatarGaze" />
<input (focus)="g.lookAt($any($event.target))" (blur)="g.lookAt('rest')" />
```

## Server-side rendering

The component renders on the server with no extra setup, and opts itself out of
hydration (`ngSkipHydration`): the browser re-renders each blobatar instead of
adopting the server's markup, which for an animated one is built differently on
each side. The server's output is the same blobatar either way.

## License

MIT
