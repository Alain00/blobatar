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

**Shape**:
Which silhouette a blobatar takes — `round`, `organic`, `boxy`, `nub`, `cloud`, or
`sun`. **Derived, never set directly.** There is no `shape` option; a caller who
wants a particular silhouette overrides the `shape` _trait_, and the same
thresholds turn it into a shape.
_Avoid_: variant, form. There is no variant axis: a `character` family existed
until 0.1.0 and was removed, and the vocabulary of six shapes is the only family
now. The specs and ADRs under `docs/` predate that and still discuss it; they are
kept as written, since a decision record that quietly changes is worth nothing.

**Trait**:
A named value pulled from the seed's hash by string key (`"hue"`, `"body.r"`),
rather than from a sequential stream. Keying by string is what lets a later
minor version add a trait without disturbing existing blobatars — and what makes a
trait addressable, so it can be pinned instead of hashed.

**Override**:
A trait pinned to a fixed value by the caller, via the `traits` option. Stated
in the same 0–1 units a hashed trait carries, never in viewBox units or degrees,
because an override is read through the layout's own range for that key. Sparse:
whatever is left out still comes from the seed. Overrides are the _only_
configuration seam — the layout function itself stays private, so every
containment guarantee still runs over a configured blobatar.
_Avoid_: prop, config value, custom trait. There is no per-knob prop and no
second vocabulary. **`shape` is still derived, not set** — you override the
trait it is derived from, which is why the rule above survives intact.

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
the surfaces that consume it.

**App**:
A workspace member under `apps/` — never published, and always consumes
`blobatar` through its public `exports` map rather than by relative path.

**Site**:
The public landing page (`apps/site`). Static, dark-only, editorial.
_Avoid_: demo, docs.

**Tuning grid**:
The internal design tool (`apps/demo`) that renders blobatars in aggregate so
numeric ranges can be judged as clusters and outliers rather than one seed at a
time.
_Avoid_: demo app, playground, storybook.

**Wall**:
The landing page's parallax field of blobatars illustrating "millions of
options". Distinct from the tuning grid, which serves design work, not
persuasion.
