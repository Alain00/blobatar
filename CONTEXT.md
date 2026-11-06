# Blobatar

A library that turns any string into a deterministic geometric blobatar, plus the
apps that exercise it — a landing page and a tuning grid.

## Language

### The blobatar

**Name**:
What a blobatar is generated from, named after what it is _for_. Every blobatar
stands for somebody — a user, a bot, a team, a repository — and that somebody
almost always has a name: a username, a display name, an email, a handle, an id.
This is the word the public API uses (`<Blobatar name={user.email} />`) and the
word to use in anything a consumer reads.
_Avoid_: input, string, key. Nothing requires a human name — an id or a uuid
works — but the word is chosen for the ninety-nine cases, not the exception.

**Seed**:
The same value seen from inside: the string that is normalized (NFC, trimmed,
lowercased unless `normalize: false`) and hashed into every trait. Use it where
the _derivation_ is the subject — "seeded lean", "the seed drives shape only",
`normalizeSeed` — and in the renderer, the hash and the geometry docs.
_Avoid_: using it in public prop names, README examples, or anything else
written for a caller. There, it is a **name**.

**Blobatar**:
A single rendered figure, and the name of the library that renders it. The React
component is `<Blobatar>`, not `<Avatar>`, because `Avatar` collides with
something in almost every host project — and once the component is `Blobatar`,
every other name follows it: `blobatar()`, `BlobatarOptions`, `blobatarUri`.
_Avoid_: avatar, morphatar, identicon. _Avatar_ is what one generically is, but
it is not what it is called here — the word survives in the npm keywords, for
search, and nowhere else.

**Generation**:
One frozen seed→look mapping: a silhouette vocabulary and its thresholds, every
numeric range the layout reads a trait into, and the tone set. Those move
together because they are observed together — a caller cannot tell which of them
changed, only that their user's blobatar is now somebody else's. `gen1` is the
original six. Adding a silhouette is **not additive**, since it takes probability
from existing silhouettes, which is the whole reason the word exists. `gen2` is
the original six plus `capsule`, `triangle`, `hexagon` and `droplet`.
The package major selects one generation; generation is not a library option.
The endpoint can pin one with `?gen=`, and otherwise serves its current default.
_Avoid_: version, edition, variant. _Version_ is the package's, and the two move
on different schedules: a package major adopts one generation, while an endpoint
query names one directly.

**Shape**:
A silhouette in the vocabulary: round, organic, boxy, nub, cloud, sun, capsule,
triangle, hexagon, or droplet. How often a shape appears belongs to the
generation, not to the shape.
_Avoid_: variant, form.

**Silhouette name**:
Which silhouette a blobatar takes. In gen1: `round`, `organic`, `boxy`, `nub`,
`cloud`, `sun`. In gen2: those six under the same names, plus `capsule`,
`triangle`, `hexagon` and `droplet`. **Derived, never set directly.** There is
no `shape` option; a caller who wants a particular silhouette overrides the
`shape` _trait_, and the current generation turns it into a silhouette — so
the same 0.88 is a cloud under gen1 and a droplet under gen2.
_Avoid_: variant, form. There is no variant axis: a `character` family existed
until 0.1.0 and was removed. A vocabulary belongs to a generation, and a later
generation replaces it wholesale rather than adding to it — gen2 keeps six of
gen1's names because they are the same silhouettes, not because it inherited
them. That is a different axis from the one `character` was. The specs and ADRs under `docs/` predate that and still discuss it; they are
kept as written, since a decision record that quietly changes is worth nothing.

**Band**:
`[shape, upper edge]` — one entry in the table that partitions [0, 1) between a
generation's silhouettes. The bands *are* the weighting: rounds and pebbles get
wide bands because they are the everyday shapes, suns a narrow one because they
should be a find. Frozen per generation, and the reason adding a silhouette is
never additive — a new band takes its mass from its neighbours.
The same structure partitions the **tone** set, which is banded pale to ink by
the same rule — so "band" is the word for both, and neither is inclusive at its
top edge.
_Avoid_: threshold, weight. A band is the interval; a threshold is one of its
two edges.

**Fit**:
How a generation fits the eye cluster into the room a silhouette leaves.
The current generation measures against the shape's own face on both axes.
It is an internal part of the frozen mapping, not a public strategy option.
See ADR-0007 for the superseded design that exposed it.

**Trait**:
A named value pulled from the seed's hash by string key (`"hue"`, `"body.r"`),
rather than from a sequential stream. Keying by string is what lets a later
minor version add a trait without disturbing existing blobatars — and what makes a
trait addressable, so it can be pinned instead of hashed.

**Mark**:
One drawing primitive: a path or a circle, with the fill it is painted in.
The figure as *data*, where the string API's output is the figure as markup.
Reached through `blobatar/internal` (`_marks`), and it exists for one reason:
`react-native-svg` has no `innerHTML`, so an adapter there builds real elements
or it builds nothing, and serializing here to parse there would put an XML
parser between the renderer and the screen.
Marks come back two ways, and the pair is the point: `_marks` is the figure with
the pose already welded into it, which is what a still blobatar wants, and
`_posed` is the same figure before the pose touched it with the pose handed back
as channels, which is what a morph needs (see _Channel_). Neither is a mode on
the other, so a consumer of one links none of the other.
A mark carries its own fill, where the string groups by fill with `<g fill>`.
Attribute inheritance is cheaper on the wire and means nothing to a renderer
that never reads a group.
_Avoid_: shape, part, element. **`shape` is the one to guard**: a shape is which
silhouette the seed picked, and a mark is one of the several primitives that
silhouette draws with. `part` is taken by `_parts`, which splits an blobatar into
`inner`/`vars`/`cls`/`bg` for a renderer that owns the outer element. That is a
different cut of the same blobatar, for a different reason.

**Override**:
A trait fixed by the caller, via the `traits` option — to one
position, or to several by **narrowing**. Stated
in the same 0–1 units a hashed trait carries, never in viewBox units or degrees,
because an override is read through the layout's own range for that key. Sparse:
whatever is left out still comes from the seed. Overrides are the _only_
configuration seam — the layout function itself stays private, so every
containment guarantee still runs over a configured blobatar.
_Avoid_: prop, config value, custom trait. There is no per-knob prop and no
second vocabulary. **`shape` is still derived, not set** — you override the
trait it is derived from, which is why the rule above survives intact.

**Narrowing**:
An override that names *several* positions for one key rather than one, leaving
the seed to pick among them. That makes three things an axis can be: open (the
key is absent, every position in play), narrowed (some of them), pinned (one).
The choice rides on that key's own hash, so a narrowed axis keeps every property
an open one had — per seed, stable, uniform over what is named, independent of
every other trait — because it *is* the open value, read against a shorter list.
Narrowing belongs to the configuration, never to a seed: one name still renders
exactly one blobatar, and "a seed with three shapes" describes something the
library must never do. The phrase for it is a config narrowed to three shapes,
of which each name gets one.
A narrowed key is a **set**, never an interval — "warm hues" is not something
it can say, and never will be, because naming two positions already means
"either of these two".
Every key can be narrowed. What differs between them is only whether the
positions have names: a silhouette or a tone is a band somebody can point at and
ask for, while a hue is a place on a wheel that has to be found first.
_Avoid_: list, multi-select, range. The first two are how it is written and how
it is chosen; the last is the thing it is not.

**Configured blobatar**:
One with traits pinned. Fully configured — every trait pinned — the seed stops
mattering, which is how a consumer builds a single fixed blobatar.
_Avoid_: custom blobatar, static blobatar. _Static_ already means "not animated".

**Tone**:
A position in the frozen swatch set for `blob`, expressible as 0–1, running
pale to ink. The swatch set is a **band** table like the silhouettes' and has
the same half-open edges, so a position picks the first swatch whose upper edge
it falls under. A hashed trait is always below 1 and every position it can
produce lands in a swatch. An explicit 1 is the one value that does not, and
**the two ways to state it disagree** — the one sharp edge in this entry:
`traits: { tone: 1 }` is clamped to just under the top edge, like every other
override, and renders ink; the `tone` option is read before that clamp and
renders the *first* swatch, so `tone: 1` renders what `tone: 0` renders.
The trait spelling is the one that means what it says. The option's answer is
the top edge showing through rather than a second spelling of pastel, and until
the two agree, the top of the range is the one place to write 0.999 rather
than 1.
Distinct from `hue`, which is an absolute angle in degrees, is inclusive at both
ends, and wraps on purpose: 360 is 0 because a circle says so, where tone's top
edge means nothing of the kind.

**Rendering mode**:
Static blobatars are a single `<img>`; animated ones are inline SVG of roughly a
dozen nodes. `animate` selects between them — the two cannot be combined,
because `:hover` and host-page CSS cannot reach inside an `<img>`.

**Adapter**:
A framework integration that owns the outer element, published as its own
package — `@blobatar/react`, `@blobatar/vue`. The roster is open and every
entry is a peer of every other. Two of them are *also* reachable as
`blobatar/react` and `blobatar/vue`, which is a fact about what already shipped
and not a tier: those subpaths are frozen and deprecated, no third is ever
added, and in v3 there are none. Owning the element is the whole of the
distinction: an adapter
can hand back an `<img>` one moment and an inline `<svg>` the next, so it is
the only thing that can honor `animate`. The string API returns markup it does
not own and ignores it.
An adapter re-expresses the library and adds nothing to it — no geometry, no
vocabulary, and no defaults of its own — so two adapters given the same name
and the same options render the same blobatar, and an option a caller leaves
out reaches the library left out. That is a rule rather than an observation:
a framework that supplies its own default for an unset prop is an adapter
inventing an answer the caller never gave.
An adapter never carries a renderer. It reads `blobatar/internal` and peer-
depends on the library, so two adapters on one page share one copy of the
geometry rather than each bundling their own — and an adapter that inlined the
library would silently stop tracking its version, which is the same failure as
drift wearing different clothes.
_Avoid_: wrapper, binding, integration. A _wrapper_ adds behavior on top; an
adapter only changes the shape of what passes through. _Binding_ suggests
something generated rather than written.

**Built adapter** / **Source-resolved adapter**:
What an adapter publishes. A **built adapter** ships JavaScript: its own
compiler ran here, and `dist` is what a consumer loads. A **source-resolved**
one ships its framework's own language — a `.svelte` file, JSX — because the
compiler that turns it into runnable code belongs to the consumer and cannot be
run in advance. `@blobatar/react`, `@blobatar/vue`, `@blobatar/preact` and
`@blobatar/solid` are built; `@blobatar/svelte` is source-resolved, and Solid is
both at once, shipping JSX behind the `solid` condition beside two builds.
The distinction is about the artifact, never about the tier: a source-resolved
adapter owes every guarantee a built one does, and is _more_ exposed rather than
less, since no build step stands between a mistake and a consumer. It is
reachable only through its framework's export condition, and offers no `default`
— a resolver without that condition gets a resolution error, which is true,
rather than a file it cannot execute, which is not.
_Avoid_: unbuilt, raw, uncompiled. All three suggest something unfinished; the
source _is_ the artifact. See ADR-0010.

**Caller-gated motion**:
`@blobatar/react-native`, and so far only it. Every other adapter takes
`animate` as a *mode*, `"hover"` or `"always"`, because the idle motion is a
stylesheet (`motion.css`, a root class, a dozen seeded custom properties) and
hover is what gates it. There is no hover on a touch screen, and `motion.css`
says so itself by pausing every loop under `@media not ((hover: hover) and
(pointer: fine))`. So the only mode this platform has is the always-on one, and
`animate` is a **boolean the caller drives** instead: screen focus, list
viewability, a user setting, the OS reduced-motion flag. All things an app knows
and a component drawn into a scroll view does not.
Motion is three components rather than three props, and each tier is a separate
export so a bundler drops the ones an app never names: `Blobatar` is still,
`MorphingBlobatar` travels between expressions, `AnimatedBlobatar` adds the idle
layer and is the only one that takes `animate`. `packages/harness/scripts/size.ts`
holds one row per tier, and a change that moves a smaller row is a tier leaking
into the one below.
The idle layer runs on the UI thread, as Reanimated worklets, because the
product this is for is a sidebar of agents all animating at once and a React
render per blobatar per frame is what makes that stutter. A library has to ship
worklets pre-compiled, so the adapter's build runs a Babel pass and then counts
the worklets in its own output: an untransformed `'worklet'` directive is an
ordinary function that silently runs on the JS thread, which looks exactly like
success. `react-native-reanimated` and `react-native-worklets` are **optional
peers**, reachable only through `@blobatar/react-native/animated`, so the two
smaller tiers link no native animation library.
That buys one exception to ADR-0009: the loops exist twice, in `blobatar/idle`
and as worklets, because a worklet cannot call an imported function. The
exception is paid for rather than waived. `packages/harness` runs both over a
sweep and asserts they agree exactly, so a transcription error is a failing test
rather than a device somebody has to notice. The pose composition is *not*
duplicated, and that is the line: it is the subtlest arithmetic in the library
and the one a real browser is used to check, so it stays in core and runs in
JavaScript, with the seesaw reaching it as an outer translate that composes
exactly.
_Avoid_: static-only adapter and idle-less adapter. Both were true in turn and
neither is now; the first describes only `Blobatar`.
Like source-resolved, this is a property of the platform and not a tier. It owes
the same equivalence row, the same exact-major peer, the same lockstep version.
Its row simply reads `_marks` instead of markup, and the option matrix it is
compared over is shared rather than restated (`packages/harness/test/cases.ts`).
_Avoid_: limited adapter, partial adapter, v1 adapter. All three imply something
that is coming; nothing here is waiting on work.

**Channel**:
One number a pose may move. `esy` is eye height, `edx` is convergence, `bdy`
lifts or sinks the whole creature. Thirteen of them plus `heat`, listed once as
the `Pose` struct in `src/morph.ts`, and a pose is nothing but a value for each.
A channel is **not** a keyframe and not an animation. There are no
per-expression keyframes anywhere: the morph between any two poses is what
interpolating these numbers does, which is why the roster is data and adding an
expression costs its numbers rather than a stylesheet.
Every channel reaches the picture through one of exactly three renderings of the
same composition, and they must agree: `bakePose` welds them into geometry for
the static path, `poseTransforms` carries them as one transform per eye for a
substrate that morphs them itself, and `.mo-eye` in `motion.css` is CSS's copy.
The first two live in one file for that reason; `test/morph.test.ts` and
`scripts/probe-compose.ts` are what hold all three together.
`heat` is the exception worth knowing: it reaches no transform. Colour is
resolved in TypeScript and travels as a fill between two finished values.
_Avoid_: property (that is the CSS spelling, `--mo-esy`, and only one of the
three renderings), knob, parameter.

**Expression**:
Which named pose a blobatar holds — `idle`, `happy`, `sad`, `mad`. Set by the
consumer and held until changed; the library never picks one and never returns
to `idle` on its own. `idle` is an expression like any other, and the default
one — not the absence of an expression.
An expression is a _value_ a consumer imports and passes, not a name it spells,
so the ones nobody imports do not ship.
_Avoid_: mood, emotion, reaction, state. _Mood_ and _emotion_ describe the
creature; an expression is what is drawn. _Reaction_ implies the library takes
it away again, which it does not.

**Season**:
A costume for a date (Halloween, Christmas), passed in as a value from
`blobatar/seasonal` like an expression, so the ones nobody imports do not ship.
A season may narrow traits under the caller's own, set the hue and tone over
`hue`/`tone`, draw marks after the eyes, and fit the figure to make room. It
never reads the clock: `seasonNow()` is the calendar, and the consumer calls it.
_Avoid_: theme (a palette the consumer owns), skin (it replaces the figure),
holiday mode, and `seasonal: true`, which would put a clock in the renderer.

**Pose**:
What an expression resolves to — the geometry of the eyes, a rigid offset for
the creature, a tremor amplitude, and how far the palette runs toward its hot
pair. Expressions never add or remove a mark, so a `blob` gains no mouth when it
is happy, and they never deform the silhouette, because in `blob` the silhouette
is the identity.
_Avoid_: face, keyframe.

**Differential**:
The part of a pose that applies to the right eye only — the `*2` channels. A
pose states one set of eye values and a delta, never two sets, so an identity of
zero is a symmetric face.
_Avoid_: per-eye override, second eye. There is no second set of values to
override, and "second eye" names the eye rather than the channel.

**Tint**:
The palette an expression wears. Resolved to a finished pair of colors before it
reaches the stylesheet, and derived from the blobatar's own palette rather than
authored once, so an angry blobatar stays recognisably itself. It is the one pose
channel with no custom property.
_Avoid_: theme, color override.

**Tremor**:
The held shake of an angry blobatar. An amplitude on a loop that always runs, not
an event — like every other motion in the library, it has nothing to start and
nothing to replay.
_Avoid_: shake animation, jitter. _Jitter_ is what the seeded layout does to
positions and means something else here.

**Morph**:
The transition from one expression's pose to another's. Symmetric in the sense
that every pair of expressions is reachable — `idle → happy` and `happy → mad`
are the same operation, not a special case each. An expression can be adopted
without a morph: static blobatars and `prefers-reduced-motion` render the target
pose directly.
_Avoid_: transition, animation — those are also what the idle loop does, and
the two are separate layers.

**Idle motion**:
The ambient loop every animated blobatar runs — breathe, bob, blink, glance. It
is gated on hover and independent of expression, which is triggered by the
consumer and is not gated at all. A blobatar can be sad and still breathing.

### The repo

**Package**:
A workspace member under `packages/` — publishable. `blobatar` is the renderer
and carries no framework; each adapter is its own package beside it, and
`@blobatar/cli` is the terminal surface. Two members are publishable-shaped but
are not: `harness` is private, and `codemod` is unscoped on purpose so the
lockstep group cannot drag it along.

**Lockstep**:
That `blobatar` and every `@blobatar/*` package publish the same version,
always. It is what keeps a major meaning one thing across a set of packages
rather than one thing per package — an adapter re-expresses the library and
adds nothing, so it has no semantics of its own to version, and its number is
the library's number. Enforced twice, because neither half is sufficient:
`fixed` keeps *published* versions in step, and an exact-major peer range
refuses the *install* that npm would otherwise resolve happily.
**The scope is the membership.** `fixed` names `@blobatar/*` as a glob, so a
package joins by being named and leaves by being renamed — which is why
`codemod` is unscoped on purpose, and why `@blobatar/cli` is in.
The CLI is the one member the adapter reasoning above does not cover: it *has*
semantics of its own — flags, output format, exit codes — and still publishes
on the library's number. That is a cost accepted, not a fact observed. It
means a flag rename cannot have its own major and waits for the library's, and
that a library patch republishes a CLI whose behavior nobody touched. The trade
is deliberate: one number across everything called blobatar is worth more to a
reader than an accurate minor on one of them.
It pins the major with a real dependency rather than the adapters' peer range,
which is the one half of the enforcement above it spells differently: someone
running `npx @blobatar/cli` has nothing else installed, so an unmet peer is a
broken command where for an adapter it is a warning in a project that already
has the library.
_Avoid_: synced, pinned. _Pinned_ is what the peer range does, which is the
other half.

**App**:
A workspace member under `apps/` — never published, and always consumes
`blobatar` through its public `exports` map rather than by relative path.

**Site**:
The public landing page (`apps/site`). Static, dark-only, editorial. Also the
deployable that puts the endpoint on blobatar.dev.
_Avoid_: demo, docs.

**Share URL**:
The **Site**'s own address carrying the hero's controls — `name`, `background`,
`hue`, `expression`, `shape`. The third surface that states a blobatar's options
as text, and it spells them the way the **Endpoint** and the **CLI** do, which
is the way the props do: `?expression=happy` because the prop is `expression`,
never `?pose=`, since a **pose** is what an expression resolves to and not
something a caller picks.
`shape` is the one key with no counterpart on the other two, and it names an
**override** rather than an option — there is no shape option to name.
What the URL carries is what identifies a blobatar and nothing about how the
page was being read, so the framework and package manager the **snippet** is
written in stay out of it.
_Avoid_: permalink, deep link, state. The first two describe the addressing; the
last is what it is deliberately not — a page's mode is not in it.

**Endpoint**:
The HTTP surface (`apps/api`) — `GET /avatar/<name>` — and the standalone Worker
serving it, which anyone can deploy to their own Cloudflare account. `apps/site`
imports it rather than copying it, so there is one endpoint with two deployments
(ADR-0005). With no `gen` query it serves the current generation and may change
when that default changes; an explicit supported `?gen=` names an immutable
generation. Unknown generations are rejected.
_Avoid_: server, API, image service.

**Editor**:
The tuning page (`apps/site`, `/editor`) where axes are pinned and narrowed
against a live preview. It has two deliverables and they are not the same kind
of thing: the **snippet** is the one that matters, and an **export** is the
other one.
_Avoid_: playground, configurator, builder. Nothing is built here — a blobatar
already exists for every name, and the page only decides which axes stop coming
from the name.

**Snippet**:
The code the editor hands you: an API call naming a seed and the traits you
pinned. A recipe, not a result — whoever runs it re-derives the blobatar, so it
tracks the library and moves with it. Pinned against the live preview, since
"paste this and get the blobatar that was on screen" is the only correctness
property the page has.
_Avoid_: sample, example. Both suggest something illustrative; this one is
exact.

**Export**:
A finished render taken out of the editor as a file — SVG, or PNG at one size.
The opposite of a snippet in the one way that matters: already derived and never
derivable again, because it carries no seed, no overrides and no generation. It
stops tracking the library the moment it is saved, so when the default
generation moves, every snippet keeps rendering the right blobatar for its major
and every export quietly becomes a picture of one that is no longer rendered.
That is the trade, and it is a fair one for a slide.
Its filename is a label rather than an identifier — two different blobatars can
land on the same one — and that is deliberate: the snippet is what identifies a
blobatar.
_Avoid_: static blobatar, download. An export is static *and* fully configured,
which is exactly the collision **Configured blobatar** warns about. _Download_
is what the browser does with it, fine on a button and wrong everywhere else.

**CLI**:
The terminal surface (`packages/cli`, published as `@blobatar/cli`) —
`blobatar <name>` with flags. It renders locally through the library, never
through the endpoint, and pins generations the same way the endpoint does
(`--gen`, both majors bundled).
It, the **Endpoint** and the **Share URL** are the three surfaces that take a
blobatar's options as text, and they hold one vocabulary deliberately: a param
carries the same name, the same range and the same meaning in `--tone 0.4` as
in `?tone=0.4`. That is
a convention kept by hand, not a shared module — each surface owns its own
table, because a query string and argv are different transports and the
endpoint's table is shaped by things a terminal has no version of: Gravatar's
`s` alias, its accepted-and-ignored spellings, a name parsed out of a path.
The cost is the thing to know: a param added to one does not appear in the
others on its own. Renaming a flag means renaming a query key in the same
change.
`--no-normalize` is the one flag with no query spelling at all — a URL always
normalizes, and the flag exists for local, case-sensitive ids.
_Avoid_: tool, command, client. It is not a client of the endpoint — nothing
here talks to the network.

**Tuning grid**:
The internal design tool (`apps/demo`) that renders blobatars in aggregate so
numeric ranges can be judged as clusters and outliers rather than one seed at a
time.
_Avoid_: demo app, playground, storybook.

**Crowd**:
Several blobatars shown together to make a point about the whole population
rather than about any one of them — that no two names come out alike, or that a
config with something narrowed does not describe a single figure. The README's
`crowd.png` and the editor's row under the preview are both this; the **wall**
is the landing page's parallax version of it, and the **tuning grid** is not one
at all, since it varies a range rather than the name.
_Avoid_: gallery, facepile, grid.

**Wall**:
The landing page's parallax field of blobatars illustrating "millions of
options". Distinct from the tuning grid, which serves design work, not
persuasion.

**Source gate** / **Ship gate**:
The two size budgets, which measure deliberately different things and are worth
keeping apart by name. The **source gate**
(`packages/blobatar/scripts/size.ts`) builds consumers that import
`../../src/*`, so it answers "what does this code tree-shake to" — it is the
one that catches a palette tweak doubling the colour code, and it depends on no
build. The **ship gate** (`packages/harness/scripts/size.ts`) resolves every
package by name through its real `exports` map, so it answers "what does
`bun add @blobatar/react` cost" and cannot run before those packages are built.
A component measured by both comes out at two different numbers — core's publish
build minifies better than a synthetic consumer of its source does — and neither
is wrong.
The ship gate covers every published package, including the source-resolved
ones, which it measures as the bytes they publish rather than as a bundle they
do not have. That number is larger and is not comparable to a built row: source
ships its comments, and what it compiles *to* is the consumer's compiler's
business. A package the ship gate skips is a package outside the sentence that
defines it. It lives in the harness because core cannot depend on an adapter
without making `^build` cyclic.
_Avoid_: calling either one "the size gate"; the ambiguity is the whole reason
they have names.
