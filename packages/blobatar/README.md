# blobatar

Deterministic geometric blobatars from any string. No dependencies, ~4.4 KB gzipped.

```ts
import { blobatar } from "blobatar";

blobatar("alain@example.com"); // => '<svg xmlns="..." viewBox="0 0 100 100">…'
```

```sh
bun add blobatar @blobatar/react
```

```tsx
import { Blobatar } from "@blobatar/react";

<Blobatar name={user.email} size={48} />;
```

```html
<script setup>
import { Blobatar } from "@blobatar/vue";
</script>

<template>
  <Blobatar name="alain@example.com" :size="48" />
</template>
```

Svelte, Solid and Preact ship the same component as `@blobatar/svelte`,
`@blobatar/solid` and `@blobatar/preact`. Same props, same behavior; each is
compiled by its own framework rather than re-using React's, so its runtime
behaves as that framework's users expect.

```sh
bun add blobatar @blobatar/react-native
npx expo install react-native-svg          # or bun add react-native-svg
```

```tsx
import { Blobatar } from "@blobatar/react-native";

<Blobatar name={user.email} size={48} />;
```

React Native builds real `react-native-svg` elements rather than markup, since
the platform has no `innerHTML` and its `<Image>` does not decode SVG. Two
things follow, and both are the platform rather than the package: `size` is
required, because there is no CSS box to inherit one from, and the motion layer
is a separate component (see below) rather than a prop and a stylesheet. An
Expo app is a React Native app and `react-native-svg` is the same library in
both, so there is no `@blobatar/expo` and there is not going to be one.

```sh
npx shadcn@latest registry add @blobatar=https://blobatar.dev/r/{name}.json
npx shadcn@latest add @blobatar/avatar
```

```tsx
import { Blobatar } from "@/components/ui/blobatar";

<Blobatar name={user.email} src={user.avatarUrl} />;
```

The shadcn item is a composition rather than a copy of the generator: it wraps
shadcn's `Avatar`, takes a `src` alongside the `name`, and falls back to a
blobatar when there is no profile image. What it installs into your project is
that wrapper, which you own; the generator stays in `blobatar` and
`@blobatar/react` as ordinary dependencies, so it keeps rendering what this
version of this package renders.

A blobatar always stands for somebody — a user, a bot, a team, a repo — so the
value it is generated from is that somebody's `name`: a username, a display
name, an email, a handle, an id. Any string works and the same string always
renders the same blobatar.

```ts
import { blobatarUri } from "blobatar/uri";

el.style.backgroundImage = `url("${blobatarUri(user.id)}")`;
```

## When to use it

Reach for blobatar when something needs a picture of somebody it has no picture
of: a user who has not uploaded an avatar, a commit author, a bot, a team, a
repository, a seat in a list. It turns any string into a stable geometric face,
so the same handle is the same creature everywhere it appears — with nothing
stored, no upload, and no request if you render in-process.

- **In an app you control** — install the package for your framework and render
  from the name you already have. No network, no cache to warm, ~4.4 KB.
- **Where an avatar has to be a URL** — an `<img src>`, an email, a Slack or
  GitHub profile field, an OG image, anything rendered by software you do not
  control: call `https://blobatar.dev/avatar/<name>`. No key, no account. See
  [the developer page](https://blobatar.dev/docs) and
  [the OpenAPI spec](https://blobatar.dev/openapi.json).
- **Replacing Gravatar** — swap the host and keep the rest of the URL. Its
  parameters are accepted, and every string renders, so nobody is left without
  an avatar.
- **As a deterministic placeholder in tests or fixtures** — the same seed is
  the same markup, byte for byte, forever within a major version.

It is the wrong tool for two jobs. It is not an identicon-compatible drop-in:
the shapes are its own, so switching from another generator changes every
existing avatar. And it is not an image host — there is no upload and nothing
you send is kept.

## Shapes

A soft body and two capsule eyes, drawn from ten silhouettes: `round`,
`organic`, `boxy`, `nub`, `cloud`, `sun`, `capsule`, `triangle`, `hexagon` and
`droplet`. They are weighted so rounds and pebbles are everyday and the louder
shapes remain a find. Transparent backdrop by default; the body is the blobatar.

The main entry also carries the palette and trait utilities. If all you do is
render, import the renderer on its own and save about a kilobyte:

```ts
import { blobatar } from "blobatar/blob";
```

## What it guarantees

**Determinism.** The same name always renders the same blobatar within a major
version. Numeric ranges, the shape thresholds, the tone set and the expression
roster are all part of that contract, and it is enforced rather than intended:
`test/golden/gen2.txt` records 1312 renders and a shape histogram over 20,000
seeds, so moving any of them fails the build.

**Stability across versions.** Traits are addressed by string key rather than
drawn from a sequential stream, so adding a trait in a later minor cannot
disturb existing blobatars. Adding a shape or a tone _would_ — those move
together, as a **generation**.

Adding a silhouette is not additive: the shape thresholds partition [0, 1), so
a new one has to take its share from the existing ones and every name in the
moved region gets a different creature. New shapes therefore arrive only in a
new package major. Upgrading `blobatar@1` → `@2` is the opt-in; applications that
stay on v1 keep both its output and package size. A major contains one frozen
generation, so the ordinary API remains just `blobatar(name, options)`.

**Contrast.** Eyes clear 4.5:1 against the body at every hue and every tone —
verified at 1° resolution in the test suite. Polarity flips automatically, so
the near-black tone gets light eyes rather than an invisible face.
Colors passed via the `palette` option bypass all of this, by definition.
A hex `backgroundColor` does not: the body is pushed off it the same way it is
pushed off the default backdrop.

**Name normalization.** Names are NFC-normalized, trimmed and lowercased before
hashing, so `Alain@Example.com` and `alain@example.com` agree, as do the
precomposed and decomposed spellings of `café`. Pass `normalize: false` to hash
the raw string. Hashing runs over UTF-8 bytes, so non-ASCII and astral-plane
names (`日本語`, `🦊`) behave consistently across engines.

**No element ids.** Nothing uses `<defs>`, gradients or filters, so rendering
several hundred blobatars on one page cannot produce id collisions.

## Options

| Option            | Default | Notes                                                                   |
| ----------------- | ------- | ----------------------------------------------------------------------- |
| `size`            | —       | Emits `width`/`height`. Omit to let CSS size it.                        |
| `background`      | none    | `"squircle"`, `"circle"`, `"square"`, or `false`.                       |
| `backgroundColor` | —       | The backdrop's fill color; needs a `background`. Keeps the contrast guarantee for `#rgb`/`#rrggbb`; other CSS colors are painted as given. |
| `hue`             | —       | Locks hue in degrees; the name then drives shape only.                 |
| `tone`            | —       | Locks the swatch as a 0–1 position in the set, pale to ink. `1` sits on the top edge and renders as `0`; use `0.999` for ink. |
| `traits`          | —       | Pins individual traits as 0–1 positions, or a list to choose among. See below. |
| `palette`         | —       | Per-key hex overrides. Bypasses the contrast guarantee.                 |
| `normalize`       | `true`  | NFC + trim + lowercase.                                                 |
| `contrast`        | `true`  | Enforce the contrast floors.                                            |
| `title`           | —       | Adds a `<title>` for screen readers.                                    |
| `animate`         | —       | `"hover"` or `"always"`. See below — it changes how the blobatar renders. |
| `expression`      | `idle`  | One of fourteen poses, imported as a value. See below.                  |
| `season`          | —       | A costume for a date, imported as a value or picked by `seasonNow()`. See below. |

## Configuring

Every axis of a blobatar is a named trait, and `traits` pins any of them. Values
are the 0–1 position the hash would otherwise have produced, so they are read in
the same units, through the same ranges, as a hashed one:

```ts
// Always a sun with wide eyes — colour and everything else still per name.
blobatar(user.email, { traits: { shape: 0.95, "eye.ratio": 0 } });
```

Keys you leave out still come from the name. That is the useful middle ground:
lock the two things that carry your brand, and every user still gets their own
creature.

A **list** narrows a key without fixing it — the name still chooses, but only
from what you named:

```ts
// Round, cloud or sun, never the other seven. Which one is still per name.
blobatar(user.email, { traits: { shape: [0.11, 0.825, 0.965] } });
```

The choice is per name, stable, and spread evenly over the values you list. An
empty list is the same as leaving the key out.

Pin everything and the name stops mattering, which is how you build one fixed
blobatar — pass any constant string alongside a full map.

Nothing is bypassed. The layout runs in full, so an eye cluster too large for
its body is scaled to fit exactly as a hashed one would be, and no combination
of values can put an eye outside the body or geometry outside the frame — the
test suite sweeps the corners of the space to prove it. The flip side is that an
extreme value can land short of where you asked; `_layout()` reports what it
actually resolved to.

`hue` and `tone` state two of these traits in friendlier units — degrees and a
swatch position — and take precedence over `traits.hue` and `traits.tone`.

Trait keys are stable across minors, like the traits themselves. The ranges they
are read into are what a stated position is relative to, so those are frozen per
major alongside the shape thresholds and the tone set.

Trait names are not enumerated here on purpose: they follow the layout. Read the
shared ones off `styles/compose.ts` and the per-silhouette ones off
`styles/shapes.ts`, or let the editor write the map for you.

## Animation

Off by default. When on, the blobatar idles: a soft breathe, a bob, a blink, and
the occasional glance to one side. Every timing and direction is drawn from the
name, so a grid reads as a crowd rather than a drill team.

```tsx
import { Blobatar } from "@blobatar/react";
import "blobatar/motion.css"; // required — nothing animates without it

<Blobatar name={user.email} animate="hover" size={48} />;
```

```html
<script setup>
import { Blobatar } from "@blobatar/vue";
import "blobatar/motion.css"; // required — nothing animates without it
</script>

<template>
  <Blobatar name="alain@example.com" animate="hover" :size="48" />
</template>
```

**Turning this on changes the rendering mode, and that is not free.** A static
blobatar is a single `<img>`; an animated one is inline SVG, roughly a dozen DOM
nodes. Content inside an `<img>` is an isolated document that `:hover` cannot
reach and host-page CSS cannot style, so there is no way to have both. A list of
400 blobatars is exactly the case the `<img>` default was chosen for.

`"hover"` animates one blobatar at a time — the right default for a grid, where
continuous ambient motion is both visual noise and 400 live animations.
`"always"` is for the single-blobatar case: a profile header, an onboarding
screen.

Motion respects `prefers-reduced-motion` by going fully static, and does not
trigger on touch, where a tap would otherwise latch hover on.

The glance is a large-size effect — at 40px it moves the eyes about half a
pixel. It is worth the most on a profile header, which is what `"always"` is
for. Eyes may cross outside the body outline on a hard glance; that is intended,
and reads as a face turning rather than as a bug.

Every web adapter takes `animate`: React, Vue, Svelte, Solid and Preact. The
string API does not, and still returns static markup. Supporting it there means
every consumer of `blobatar()` carries the motion code whether they animate or
not, which is a real cost for a feature most callers will never use. If you need
animated markup without a framework, open an issue: it wants its own entry point
rather than a branch inside `blobatar()`.

### Following the pointer

The eyes can track the cursor. This is the one motion layer that needs
JavaScript, so it ships as its own entry point and a second stylesheet, and a
page that never imports them pays nothing for it.

Every adapter wraps it, each behind a `/gaze` subpath of its own so that
importing `Blobatar` links none of it:

```tsx
import { Blobatar } from "@blobatar/react";
import { useGaze } from "@blobatar/react/gaze";
import "blobatar/motion.css";
import "blobatar/gaze.css"; // required — the eyes hold still without it

const { ref } = useGaze({ travel: 3 });
<Blobatar ref={ref} name={user.email} animate="always" size={200} />;
```

The binding takes the shape its framework reaches an element with, and that is
the only thing that differs between them — same options, same targets, same
driver:

| | |
| --- | --- |
| `@blobatar/react/gaze` | `useGaze()` hands back a `ref` |
| `@blobatar/preact/gaze` | the same hook; the ref goes on `elementRef`, since Preact keeps `ref` from a function component's props |
| `@blobatar/vue/gaze` | `useGaze(blobRef, …)` takes the template ref you already own |
| `@blobatar/solid/gaze` | `createGaze()` *is* the ref |
| `@blobatar/svelte/gaze` | `gaze()` is an attachment: `{@attach eyes}` |

Each adapter's README has the two-line integration. Anywhere else, drive it
yourself against the `<svg>`:

```ts
import { gaze } from "blobatar/gaze";

const g = gaze(svgEl);
```

The excursion is what opts a blobatar in. `--mo-track-travel` is registered with
an initial value of `0px`, so with the stylesheet loaded and nothing else done
every blobatar on the page holds still. Every binding takes it as `travel`;
without one, set the property on the blobatar or on anything above it, and that
subtree follows:

```css
.hero .mo-eyes { --mo-track-travel: 3px; } /* viewBox units, ~1.5–4 reads well */
```

Pick one route, not both. A rule matching `.mo-eyes` wins over the hook's
`travel`, not the other way round: the hook writes the property inline on the
`<svg>` and the eyes inherit it from there, and a declaration on the element
itself always beats an inherited value however that value was written. Set both
and the rule is what you get, silently. The symptom is a face that renders
perfectly and never moves, which is the same thing you see when nothing sets the
excursion at all.

The idle glance stands down on its own while the gaze is driving, so the eyes
are not being aimed at two things at once, and it fades back in when the driver
detaches rather than snapping.

`gaze()` returns a handle. `lookAt` is the one seam for aiming it, and it takes
five kinds of thing:

```ts
g.lookAt({ x: caretX, y: caretY }); // a point in client coordinates — a caret
g.lookAt(button); // an element: its centre, re-read as the page moves
g.lookAt("pointer"); // the cursor
g.lookAt("rest"); // its own centre, held: deliberately not looking
g.lookAt(null); // nothing — the eyes ease home and the idle glance comes back
```

A driver starts at `null`, so `gaze(svg)` arms the layer and moves nothing until
it is aimed. `gaze(svg, { target: "pointer" })` is the cursor-following blobatar
most pages are after, and it is spelled out rather than assumed: constructing a
driver is not the same as deciding what it should watch.

`"rest"` and `null` are both "stop looking at that" and they are not the same
request. `"rest"` keeps the idle glance stood down, so the stillness reads as a
face choosing not to look; `null` hands the blobatar back to its own life with
the driver still attached. Neither is `stop()`, which is teardown: it removes
every listener and both properties, and the eyes snap rather than glide.

Passing an element is the one worth reaching for. The driver already re-reads
its own box on scroll, resize and its own resizes, so a watched element rides on
the same machinery and keeps its aim through all three — which is exactly the
pair of listeners a caller otherwise writes by hand around `getBoundingClientRect`,
and usually only one of them.

It follows the same rules as the rest of the motion layer, and for the same
reasons: nothing attaches under `prefers-reduced-motion` or without a fine
pointer, and both are watched rather than sampled once, so turning reduced
motion on mid-session detaches the driver. A settled blobatar under a still
pointer schedules no frames at all.

`blobatar/gaze` also exports the pursuit as pure arithmetic — `step`, with no
clock and no DOM — for renderers that solve frames out of order.

This is a large-size effect. On a 40px avatar in a list it is a fraction of a
pixel; it earns its place on the one big blobatar a page is about.

### React Native

There is no stylesheet on this platform and no `:hover` for one to key off, so
the motion layer is a second component rather than a prop:

```tsx
import { AnimatedBlobatar } from "@blobatar/react-native/animated";

<AnimatedBlobatar name={user.email} size={48} animate />;
```

`animate` is a boolean the app drives, defaulting to false. The always-on mode
is the only one a touch screen has, and *when* to run it is a question the app
can answer and a component drawn into a scroll view cannot. Turning it on or off
ramps over 400ms rather than cutting, and lands on exactly the still blobatar.

The loops are Reanimated worklets, so a screen full of blobatars animating at
once costs no React render per frame. `react-native-reanimated` and
`react-native-worklets` are optional peer dependencies needed only by that
subpath: `Blobatar` stays at the package root and links neither.

## Expressions

A pose the blobatar holds until you change it. Setting one morphs from whatever
it was wearing.

| pose        | reads as                                                    |
| ----------- | ----------------------------------------------------------- |
| `idle`      | the default — byte-identical to passing nothing              |
| `happy`     | tall arcs, lifted, tilted in parallel                        |
| `sad`       | small eyes dropped low, brows in                             |
| `mad`       | wide flat bars in a `\ /`, warm-tinted, trembling            |
| `surprised` | the only pose that grows the eyes — wide and lifted          |
| `wink`      | one eye shut, the other open                                 |
| `sleepy`    | level lids low over a sunk body                              |
| `smug`      | narrow and cocked — a head tilt, not a brow                  |
| `unsure`    | one eye squeezed, the pair barely moved                      |
| `scared`    | small, converged, shivering                                  |
| `love`      | narrow and drawn together, rose-tinted                       |
| `shy`       | small, low, converged, pale blush                            |
| `sick`      | wide bars slumped into a `/ \`, green-tinted, faint tremor   |
| `thinking`  | eyes at two heights, trading places — a loader with a face   |

Expressions are **imported as values, not named as strings**, so you ship the
ones you use and nothing else:

```tsx
import { happy, idle } from "blobatar/expression";

<Blobatar name={user.email} animate="always" expression={happy} size={64} />;
```

`thinking` is the one pose that keeps moving. It holds a staggered pair of eyes
and, with `blobatar/motion.css` loaded, seesaws them on a 900ms cycle — the
two-dot loader, drawn with the two dots a blobatar already has. Set it while you
are fetching and clear it when you are done; like every other pose it is a state
you hold, not an animation you fire. Without the stylesheet, or under
`prefers-reduced-motion`, it holds one frame of that swing, which still reads as
a creature with its attention somewhere else. Whatever it is waiting on still
needs to be announced somewhere real in your DOM — the face is decoration.

The same values work with `@blobatar/vue`; only the import of the component
itself changes.

The first expression you import costs about 340 bytes (the shared serializer and
bake, paid once) and each untinted one after it about 35. The four tinted poses —
`mad`, `love`, `shy`, `sick` — are the exception: the first of them pulls in the
OKLab colour path for about 720 bytes, and each tinted one after that costs about
60, because they share one walk with four targets. The whole roster is about 1.5
KB over `blob` alone; a consumer who imports none carries no pose code at all,
which is why `expression` is a value rather than a string.

**A state, not an event.** Nothing returns to `idle` on its own and there are no
timers. If you want a burst, schedule the clear yourself:

```ts
setMood(happy);
setTimeout(() => setMood(idle), 1200);
```

**Independent of `animate`, in both directions.** Without `animate` you get the
pose statically, which is why this works in the string API and under
`prefers-reduced-motion`. The _morph_ needs `animate`, because that is what puts
the blobatar in inline SVG where CSS can reach it. Setting `expression` never
turns `animate` on for you — that would silently flip a 400-blobatar grid from 400
`<img>` tags to 400 SVG trees.

```ts
blobatar(name, { expression: happy }); // static, posed, no morph
```

`idle` renders byte-identical markup to omitting the option, so adding this
moved no existing blobatar.

The pose moves parts the blobatar already has — eye scale, tilt, offset, a rigid
body shift, a tremor and a tint — and never adds a mark, so a blob grows no mouth
when it is happy. That ceiling is real and worth knowing before you reach for it.
`happy`, `surprised` and `wink` read unmistakably, because a shape nothing else
in the roster wears is doing the work. The rest read as clearly different from
idle and from each other, without announcing the emotion the way a mouth would:
`sick` is not going to read as nausea on its own, but you will never mistake it
for `sleepy`. Two capsules and a soft body only go so far, and every pose here is
separated from its nearest neighbour by three channels rather than one — never by
its tint alone, so the roster still works in greyscale. See
[docs/expression-spec.md](./docs/expression-spec.md) for what carries signal and
what does not.

Expressions are decorative and do not reach assistive technology: `title` names
who the blobatar is and does not change with the pose. Under reduced motion the
pose is adopted instantly at full strength — the morph is removed, the
expression is not.

## Seasons

```ts
import { blobatar } from "blobatar";
import { seasonNow } from "blobatar/seasonal";

blobatar(user.email, { season: seasonNow() });
```

A season dresses the blobatar for a date. Keep that line in and the figure is a
pumpkin or a ghost around Halloween, wears a Santa hat through Christmas, and
is itself the rest of the year: `seasonNow()` returns `undefined` outside a
season, and `undefined` is no costume at all.

| Season      | Window         | Costume                                     |
| ----------- | -------------- | ------------------------------------------- |
| `halloween` | 24 Oct – 1 Nov | a pumpkin or a ghost, one per name          |
| `christmas` | 10 – 26 Dec    | a Santa hat, and a beard for half the names |

`seasonNow(date = new Date())` is the only function here that reads a date,
and you call it, so a server can pin one per request and a test can pin one at
all. `blobatar()` sees only the season you pass, which keeps a seasonal render
deterministic and cacheable. To pin a season regardless of the date, import
`halloween` or `christmas`. A season you don't import costs nothing; one you do
costs about 1.6 KB gzipped.

Halloween keeps to four silhouettes (round, organic, boxy and cloud) and stands
the body nearly upright, so some names change shape for the week. Names with a
warm hue tend to become pumpkins and cool ones ghosts, and a cloud is always a
ghost. A pumpkin is orange whatever your `hue`; a ghost is a pastel of it. The colours
go through the usual ramp, so the contrast guarantee holds. Your own `traits`
win over the season's narrowing, and `palette` wins over its colours. The look
is the trait `season.pick` and the beard is `season.beard`, so both can be
pinned:

```ts
import { halloween } from "blobatar/seasonal";

blobatar(name, { season: halloween, traits: { "season.pick": 0.9 } }); // a ghost
```

Omitting `season` renders byte-identical markup to 2.8.

## How it works

**One primitive carries the symmetric shapes** — the superellipse
`|x/a|^n + |y/b|^n = 1`. `n=2` is an ellipse, `n≈4` a squircle, `n≈5` a rounded
bar. Each quadrant is one cubic Bézier whose control offset is solved so the
curve passes exactly through the 45° point; at `n=2` that yields 0.5523, the
standard circle constant. Four segments keeps a part at ~130 bytes of path data.

**A closed Catmull-Rom spline carries the organic ones.** Radii sampled around a
circle and joined into a loop, so a hash perturbing them by ±16% produces
lopsided pebbles with no noise function. Catmull-Rom interpolates its points
exactly, which is what makes the radii mean what they say and keeps containment
predictable.

**Overlapping fills replace boolean geometry.** Clouds, suns and nubs are just
extra circles drawn in the same `<g fill>` behind the core. They union visually
for free — no path arithmetic, no clip paths, no element ids.

**Eye dimensions are fractions of the body radius**, not absolute units. Bodies
range from 22 to 38 units depending on how much room the decoration needs, and
absolute sizes would drift off a small sun while looking lost on a large round.

Colors are resolved from OKLCh to hex at render time rather than emitted as
`oklch()`, because server-side rasterizers largely do not support it and blobatars
get rasterized server-side constantly.

Whole blobatars land at 590–1060 bytes of markup.

## Development

Run these from the repo root — this package lives in a Bun workspace alongside
`apps/site` (the landing page) and `apps/demo` (the tuning grid).

```sh
bun dev        # tuning grid at localhost:3001
bun site       # landing page at localhost:3000
bun test       # 94 tests
bun run size   # per-entry gzip budgets
bun run check
```

Both apps depend on `blobatar` as `workspace:*` and import it by its public
entry points, so they resolve through the real `exports` map rather than by
relative path — breaking an export breaks their build. See
[ADR-0001](../../docs/adr/0001-bun-workspaces-without-turborepo.md).

The tuning grid is the real design tool. Numeric ranges can only be judged in
aggregate — you are looking for clusters, dead zones and outliers, which are
invisible when you inspect one name at a time. The shape filter exists because
the rarer silhouettes would otherwise show up a handful of times per page, too
few to tune against.

`test/geometry.test.ts` covers what eyeballing cannot: that no name anywhere in
the space puts an eye off the body, fuses two capsules together, detaches a
petal, or pushes geometry outside the frame.
