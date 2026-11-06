# Seasons are passed-in values, and the calendar is the caller's

Blobatar 2.9 adds seasons: a costume for a date, so that a grid of blobatars is
a grid of pumpkins and ghosts around Halloween and of Santa hats through
Christmas. A season is a value the caller passes;
the calendar is a function the caller calls.

```ts
import { blobatar } from "blobatar";
import { seasonNow } from "blobatar/seasonal";

blobatar(user.email, { season: seasonNow() }); // undefined outside a season
```

A **season is a value** imported from `blobatar/seasonal` (`halloween`,
`christmas`) carrying everything it needs to dress a figure. `blobatar()` calls
through whatever it is handed and imports nothing from the module. **The
calendar is `seasonNow(date)`**, a plain function beside the seasons, and the
only thing in the package that reads a date.

## Why not `seasonal: true`

A boolean would have put `new Date()` inside `blobatar()`. Three promises rule
that out:

- **Determinism.** The same name renders the same markup within a major, and
  `test/golden/gen2.txt` enforces it byte for byte. A renderer that consulted
  the clock would fail that test on the morning of October 24th.
- **The immutable cache.** The endpoint serves `?gen=` URLs with
  `max-age=31536000, immutable`. Output that varies with the date cannot sit
  behind that header.
- **Adapter neutrality** (CONTRIBUTING.md). An adapter adds nothing to the
  library, so none of them may decide "it is Halloween" on its own. A boolean that every
  adapter resolved against its own clock would be seven calendars.

Passing the season in keeps all three. Turning seasons on is one line in the
caller's code, and that line is where the date belongs.

## Why a value and not a string

ADR-0002, for the same reasons. `season: "halloween"` would have put the
costumes, their serializer and the calendar into the core for every consumer.
Measured on the `blob + halloween` row of `scripts/size.ts`, a costume is
~1.6 KB gzipped to the consumer who imports it and nothing to the one who does
not. The core pays 93 B for the seams a costume reaches through.

## What a season may touch

Three seams:

1. **Traits**, merged *under* the caller's own `traits`. Halloween narrows the
   silhouette to round, organic, boxy and cloud, the four that read as a
   pumpkin or a sheet, and stands the body near-upright (`body.rot`). These
   are narrowings, so the body stays derived and a caller who narrowed further
   keeps their narrowing; the cost is that a name outside those silhouettes
   takes a different one at Halloween. Which look a name gets is a new trait
   key, `season.pick`, additive under ADR-0003 and pinnable like any other.
2. **The hue and tone the palette is built from**, *over* `hue`/`tone`. A
   pumpkin is orange whatever the brand hue. The season returns inputs to the
   ramp rather than finished colours, so the eye floor still runs over them.
   An explicit `palette` still wins, because that option bypasses every
   guarantee by contract.
3. **`dress`**: marks drawn after the eyes, each in its own fill, and a
   transform around the figure, composed ahead of the pose's own wrap into the
   one `transform` the figure's `<g>` already took. The transform is measured,
   not declared: `frame()` takes the costume and the body, pads every height
   for the furthest a pose moves the body, shrinks the figure only as far as
   its height or width demands, and otherwise slides it in. The backdrop stays outside it, as it stays outside the
   pose. A costume never covers an eye; `test/seasonal.test.ts` sweeps that.

The costume is drawn from the resting layout and palette on every path,
inside `.mo-bob` when animating, in one `<g>` that takes `motion.css`'s
structural body rule. Its marks in the head colour (a ghost's sheet) tint with
the body under `mad` or `love`; marks with a fill of their own keep it. The
stylesheet change is a comment.

## Consequences

- Shipped as a **minor**. The mapping does not move: every render without
  `season` is byte-identical, and the golden fixture grew by 87 cases and
  changed none.
- `_posed` gains `costume` and `fit`, and `_marks` returns the costume as the
  tail of its list, both additions to `blobatar/internal`. The React Native
  morphing components draw the costume apart from `Body`, which paints
  everything in the travelling head colour.
- Every adapter forwards `season` the way it forwards `expression`, and the
  harness matrix has a row for each season.
- Under a tinting expression, a pumpkin's ribs and a ghost's mouth keep their
  resting colours while the body and eyes tint. They have fills of their own,
  and keeping them resting is what keeps every renderer in agreement.
  Accepted.
- Windows are fixed per season and inclusive at both ends, in the caller's
  local time. Widening one is a minor; it changes nothing a name renders.
- The endpoint, the CLI and the site don't expose seasons yet.
  `?season=halloween` would be cacheable like any other parameter;
  `?season=auto` would need a short `max-age` and must be refused on `?gen=`
  URLs.
- The Flutter port has no `season` option yet; its parity table says so.
