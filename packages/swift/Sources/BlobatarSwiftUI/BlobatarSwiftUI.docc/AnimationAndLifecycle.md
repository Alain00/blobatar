# Animation and Lifecycle

Choose a motion policy and tell animated views when application-owned content
is visible.

## Motion policies

`BlobatarAnimation/always` runs deterministic breathe, bob, blink, and
saccade motion continuously. `BlobatarAnimation/hover` ramps ambient motion
and a small lift in while a pointer is over the view. Hover is meaningful only
on a platform and device that deliver pointer hover; use the always-on policy
for touch-first presentation.

Both policies resolve their random-looking parameters from the name. A shared
monotonic elapsed-time clock drives every transform, so frame rate does not
alter the result.

## Activity and scene state

Pass `active: false` when an application knows a row or page is off-screen.
``AnimatedBlobatar`` also stops requesting continuous frames while its scene is
inactive. These two signals cover application visibility and platform
lifecycle without relying on fragile geometry heuristics inside the reusable
view.

The view respects Reduce Motion by default. With reduction enabled it renders
the resolved static pose and does not request an animation timeline. Set
`respectsReducedMotion` to `false` only when the host application provides an
equivalent accessibility control.

## Updates and transitions

Expression changes morph through the upstream easing and duration. Identity,
trait, palette, and silhouette changes cut to the new resolved drawing rather
than interpolating unrelated geometry. Updating any public input invalidates
the view immediately; no second state mutation is required.

The module exposes `BlobatarAnimationModel` for renderers that need the same
pure elapsed-time calculations without using ``AnimatedBlobatar``.
