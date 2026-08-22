# Plan: 3D blobatars with directional expression motion

**Status: implemented.** The council converged (two advisors, two passes; see
the decision record at the bottom) and the build landed on this branch. §6's
open decisions are resolved below and in the implementation.

Reads after [motion-spec.md](./motion-spec.md) and
[expression-spec.md](./expression-spec.md), which this extends and does not
replace.

---

## 1. The request, stated plainly

Two things are being asked for:

1. **3D avatars** — blobatars should read as having depth, not as flat cutouts.
2. **Directional motion** — the expression-bearing figure should travel across
   its frame along one of four cardinal directions: right→left, left→right,
   top→bottom, bottom→top. The direction may be chosen by the caller or derived
   from the seed.

Everything below is written against the constraints that make this repo what it
is, because those constraints decide most of the design before taste enters:

- A blobatar is a **pure function of a string**. Same name ⇒ same render,
  within a major. Anything that moves must move deterministically per seed, or
  be explicitly caller-supplied configuration.
- The library ships **SVG + one CSS stylesheet**, no dependencies, under two
  size gates (source gate and ship gate). A WebGL runtime cannot live here.
- Static rendering is a single `<img>`; only `animate` switches to inline SVG.
  Motion is opt-in, hover-gated by default, and answers to
  `prefers-reduced-motion`.
- Adapters re-express the library and add nothing; any new option must flow
  through every adapter identically or not at all.

---

## 2. What "3D" can mean here — three candidates

### Option A — depth within the SVG (recommended)

Pseudo-3D rendered inside the existing pipeline:

- **Layered depth**: body, eyes/marks, highlight and ground shadow become
  separate groups already implied by the markup contract (motion-spec §7).
  Depth reads from a seeded vertical offset of a soft ground shadow, an
  internal highlight that sits "above" the eye plane, and parallax between the
  layers when the figure moves.
- **Tilt as pose**: a small `rotateX`/`rotateY` perspective transform on the
  root group during travel — leaning into the direction of movement — gives
  the illusion of a volume turning rather than a decal sliding.
- **Shading, not geometry**: a radial gradient keyed off the existing OKLCh
  palette (the same rule expression-spec §11 protects — colour stays derived)
  darkens the lower hemisphere so the silhouette reads as lit from above.

Costs almost nothing in bytes; changes no static render (a static `<img>`
gains at most the shadow/highlight layers, which is a visual change that needs
its own golden-fixture conversation — see §6).

### Option B — CSS 3D transforms on the inline SVG

`perspective()` + rotate on the host element, driven from `motion.css`. Cheap,
reversible, and invisible to static mode. This is not a rival to Option A but
its delivery mechanism: Option A draws the depth cues, Option B animates them.
Listed separately because the tilt could ship alone as a first slice.

### Option C — real 3D (three.js / WebGPU / model files)

Rejected for the core, and the rejection is structural rather than taste:

- Breaks "no dependencies" and both size budgets by orders of magnitude.
- Breaks the string API and the endpoint (`/avatar/<name>` returns bytes; a 3D
  avatar returns a scene graph plus a runtime).
- Breaks the `<img>` static mode entirely — there is no static frame without a
  renderer.
- Breaks adapter neutrality: React Three Fiber ≠ Vue equivalents; adapters
  would stop re-expressing and start each owning a stack.

If real 3D is ever wanted, it belongs in an **optional companion package**
(`@blobatar/three`) outside the lockstep group, consuming `blobatar/blob`'s
layout export for geometry placement — the same seam the CLI and endpoint use.
That keeps the core's guarantees intact while letting a 3D surface exist. Out
of scope for this plan; recorded so the door is visibly open.

---

## 3. Directional travel — the design

### 3.1 The channel, not a new feature bolt

The idle loop already has breathe, bob, blink, glance (motion-spec §4), all
driven by seeded custom properties read by `motion.css`. Travel is **one more
idle-loop channel**, not a second motion system:

- Key: `travel`, joining `Animate = "hover" | "always"` as an option on every
  adapter and the string API — same shape, same defaults-absent rule
  (CONTEXT.md, *Adapter*).
- Value: `"none"` (default — nothing changes for anyone) or one of four named
  directions: `"rtl"`, `"ltr"`, `"ttb"`, `"btt"`. Names spelled as the reading
  directions they describe, matching how the request was phrased.
- A fifth value, `"seeded"`, lets the name pick the direction — a uniform
  `pick` over the four, drawn from a new trait key `travel.dir`. Per the traits
  contract (traits.ts header): adding a key is free; the *contents* of the pick
  array freeze per major, which is exactly what the four-value roster wants.

### 3.2 What travels

The **whole figure**, root group, shadow included — the creature walks, not
its eyes. Gaze/saccades stay independent (a blobatar can glance while drifting),
and the held expression is untouched: travel composes with expressions the way
idle motion already does (CONTEXT.md: *Idle motion* vs *Expression* are separate
layers).

### 3.3 The numbers, all seeded where the caller is silent

Following animate.ts's pattern — every timing/offset is a custom property fed
from a trait — travel adds:

| trait key        | feeds                       | range (draft)     |
| ---------------- | --------------------------- | ----------------- |
| `travel.dir`     | direction when `seeded`     | pick of 4         |
| `travel.dist`    | horizontal/vertical span    | 4–10 viewBox units |
| `travel.period`  | full traversal duration     | 9–16 s            |
| `travel.phase`   | negated start offset        | 0–period          |
| `travel.tilt`    | lean amplitude (Option B)   | 0–4 deg           |

Negated phase at the source, same as `--mo-phase` — a grid must never set off
in unison. Independent phase from breathe/bob, same reasoning as their
independent offsets.

### 3.4 Loop semantics: traverse-and-wrap, not bounce

A blobatar that reaches the frame edge and reverses reads as a screensaver.
Traverse-and-wrap — exit one side, re-enter the other — reads as a crowd
walking through. Wrap requires the inline-SVG mode only; in `<img>` static mode
there is nothing to wrap and nothing changes. Edge case to settle in review:
does the figure fade at the exit edge or clip hard? Draft answer: clip hard,
matching the viewBox contract, revisit if it looks like a glitch.

### 3.5 Hover gate and reduced motion

Travel joins hover-gating by default (`"hover"` animates one blobatar at a
time; motion-spec §2's frequency argument applies double to whole-figure
translation). `prefers-reduced-motion` freezes it at its seeded phase position
— a stopped mid-frame, not a vanished blobatar, consistent with §8 of the
existing spec.

---

## 4. What does NOT change

- **Static renders.** With `travel` unset, output is byte-identical to today.
  Golden fixtures do not move.
- **The endpoint and CLI.** They serve static renders; neither grows a flag in
  v1 of this feature. (The endpoint vocabulary convention says a param added to
  one surface waits for a deliberate decision to add it to the other — noted
  here so the absence is a decision, not drift.)
- **Expressions.** No pose channel references travel; morph timing unaffected.
- **Generations.** No band table moves; no new silhouettes; this is not a
  generation event.

---

## 5. Build order

1. **Probe first** (the lesson of expression-followups.md: `bun test` cannot
   see across the CSS gap). Extend the probe pattern used by
   `scripts/probe-compose.ts` / `amp-probe.html`: render a grid with all four
   directions × three seeds, headless Chrome, assert phase offsets differ and
   reduced-motion freezes.
2. **Renderer markup pass** (Option A layers): ground-shadow group, highlight,
   gradient — behind a flag-less structure that costs nothing when unanimated.
   Decide golden-fixture question (§6) before merging this step.
3. **`travel` option + trait keys** in `render.ts`/`animate.ts`; wire through
   `blob.ts`, `blobatar.ts`, `internal.ts` for adapters.
4. **`motion.css` keyframes** for the four directions, reading every value from
   custom properties; zero literal per-blobatar numbers in the stylesheet.
5. **Adapters**, one commit each, mechanically identical prop pass-through.
   Harness equivalence test extended: same name + same `travel` ⇒ same markup
   on React/Vue/Solid/Preact/Svelte.
6. **Ship/source size budgets** re-measured; README section drafted only once
   numbers exist.
7. **Editor exposure** (apps/site): a direction picker beside the expression
   picker, snippet gains the `travel` prop. Export unchanged.

---

## 6. Open decisions — RESOLVED by council

The council (oracle, forked context; reviewer) converged across two passes on:

1. **Static renders do not change.** Both advisors flagged the draft's
   recommendation (a) as a blocker: `test/golden.test.ts` pins static output
   byte-identical within a major ("a failure is not a fixture update"), and
   `src/blobatar.ts` publishes the same guarantee. Depth cues therefore ship in
   the **animated inline-SVG path only**: a ground-shadow ellipse (outside
   breathe/bob, inside travel — grounded while the creature bobs over it), and
   a sheen pinned to the upper face *under* the eyes. Plain palette-derived
   geometry — gradients need ids (this library emits none) and filters repaint
   per frame. Full static depth waits for the next major.
2. **Default `"none"`**, and travel is **adapter-honored only**, exactly like
   `animate`: the string API ignores it (the ~190 B branch argument), React's
   union carries it on the animated arm, Vue declares it with
   `default: undefined`. It is also deliberately **not gated on hover**:
   folding position through `--mo-amp` glides the figure home on hover-out,
   which is the wrong shape for a walk — opting in per render is the gate.
3. **Traverse loop — fade-wrap superseded by ping-pong (owner call after
   visual review).** The council converged on fade-wrap (opacity dips to 0 at
   both extremes so the edge-to-edge jump is invisible); the probe verified it;
   the owner rejected it on sight — a blobatar that spends part of its loop at
   opacity 0 is a hole in the grid, and this library's whole product is "a face
   for every name". Nothing here may disappear. The shipped loop is a
   **ping-pong traverse** (`animation-direction: alternate`, ease-in-out):
   cross, reverse, cross again, every frame fully present. Reversal reads as
   pacing rather than as a screensaver because lean, bob, blink and gaze stay
   live through it. Reduced motion removes the animation outright (figure rests
   center); touch devices likewise get removal rather than pause.
4. **Endpoint/CLI flags deferred**, unchanged from the draft.

Two further corrections adopted in pass 2:

- **Transform-property ownership map**: whole-figure motion lives on a new
  `<g class="mo-travel">` owning `translate` + seeded ±2° `rotate` — claimed by
  nothing else on any element (root owns `transform`, bob `transform`, saccade
  and tremor `translate` elsewhere). Real perspective rotateX/Y dropped:
  engine-risky per motion-spec §4.7's history.
- **Probe discipline held**: the compose probe caught a real defect the unit
  suite could not see — the sheen originally painted over the eyes, which its
  `elementFromPoint` sampling read as eye movement during blinks. Sheen moved
  under the eyes, which is also the correct layering.

Budgets absorbed the cost with documented bumps in both gates (core `size.ts`
and harness `size.ts`); the video app's byte-count pin (`apps/video/src/swap.ts`)
was re-measured for the same reason.

## 7. Budget sketch (to be filled by measurement, not hope)

- Renderer: shadow + highlight + gradient ≈ 0.4–0.8 KB pre-gzip against the
  ~4.4 KB budget — measured at step 6 before any README claim.
- `motion.css`: five keyframe blocks sharing one translate primitive; target
  under 0.5 KB gzipped.
- Traits: five new string keys, zero disturbance to existing seeds — the
  append-only namespace paying its rent again.

## 8. Acceptance

- [ ] Static output byte-identical (decision 1 resolved either way and encoded
      in goldens).
- [ ] Same name + same `travel` ⇒ identical markup across all five adapters.
- [ ] Four directions verified in headless Chrome, phases non-uniform over ≥
      100 seeds.
- [ ] `prefers-reduced-motion` holds a frozen frame, verified in the probe.
- [ ] Both size gates green; harness packaging test still sees one copy of the
      renderer.
