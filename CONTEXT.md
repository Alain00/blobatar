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
A position in the frozen swatch set for `blob`, expressible as 0–1. Distinct
from `hue`, which is an absolute angle in degrees.

**Rendering mode**:
Static blobatars are a single `<img>`; animated ones are inline SVG of roughly a
dozen nodes. `animate` selects between them — the two cannot be combined,
because `:hover` and host-page CSS cannot reach inside an `<img>`.

**Adapter**:
A framework integration that owns the outer element — `blobatar/react`,
`blobatar/vue`. Owning the element is the whole of the distinction: an adapter
can hand back an `<img>` one moment and an inline `<svg>` the next, so it is
the only thing that can honor `animate`. The string API returns markup it does
not own and ignores it.
An adapter re-expresses the library and adds nothing to it — no geometry, no
vocabulary, and no defaults of its own — so two adapters given the same name
and the same options render the same blobatar, and an option a caller leaves
out reaches the library left out. That is a rule rather than an observation:
a framework that supplies its own default for an unset prop is an adapter
inventing an answer the caller never gave.
_Avoid_: wrapper, binding, integration. A _wrapper_ adds behavior on top; an
adapter only changes the shape of what passes through. _Binding_ suggests
something generated rather than written.

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
A workspace member under `packages/` — publishable. `render-core` is the
deliberate exception: a private support package, never published, bundled into
the surfaces that consume it. Deciding that category is ADR-0009's job, not
this entry's; here it is only named.

**App**:
A workspace member under `apps/` — never published, and always consumes
`blobatar` through its public `exports` map rather than by relative path.

**Site**:
The public landing page (`apps/site`). Static, dark-only, editorial. Also the
deployable that puts the endpoint on blobatar.dev.
_Avoid_: demo, docs.

**Endpoint**:
The HTTP surface (`apps/api`) — `GET /avatar/<name>` — and the standalone Worker
serving it, which anyone can deploy to their own Cloudflare account. `apps/site`
imports it rather than copying it, so there is one endpoint with two deployments
(ADR-0005). With no `gen` query it serves the current generation and may change
when that default changes; an explicit supported `?gen=` names an immutable
generation. Unknown generations are rejected.
_Avoid_: server, API, image service.

**CLI**:
The terminal surface (`packages/cli`, published to npm as `blobatar-cli`) —
`blobatar <name>` with flags. It and the Endpoint are the two string surfaces,
and they speak one sentence: both parse through `render-core`'s single table,
so a param carries the same name, range and error text in a query string and
in argv. The asymmetries are transport-shaped, one per direction:
`--no-normalize` exists only in the terminal (a URL always normalizes), and
the Gravatar compatibility spellings (`s`, the accepted-and-ignored params)
exist only in a URL. Renders locally through the library, never through
the endpoint, and pins generations the same way (`--gen`, both majors
bundled).
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
