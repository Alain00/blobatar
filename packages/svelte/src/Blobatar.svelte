<!--
  `@blobatar/svelte` — the Svelte adapter.

  A real Svelte component rather than a JavaScript one that builds DOM by hand,
  which is what ADR-0009 split the packages to make possible: the transform this
  file needs is the Svelte compiler itself, and no `Bun.build` call can hold it
  beside React's transform and Preact's runtime.

  It is also the reason this package ships source instead of a `dist` — see
  ADR-0010. The compiler that turns this into renderable code belongs to the
  consumer, not to this repo.
-->
<script lang="ts">
  import { _parts } from "blobatar/internal";
  import { blobatarUri } from "blobatar/uri";
  import type { HTMLImgAttributes, SVGAttributes } from "svelte/elements";
  import type { BlobatarProps } from "./types";

  // `class` and `style` are pulled out by name because both are merged rather
  // than forwarded: the custom properties the motion reads live in `style`, and
  // the root `<g>` carries a class of its own. Everything else in `rest` goes
  // straight onto the element — a `traits` object spread onto an `<img>` is a
  // malformed attribute per blobatar, which is why the options are named here.
  let {
    name: seed,
    size,
    background,
    palette,
    hue,
    tone,
    normalize,
    contrast,
    title,
    animate,
    travel,
    expression,
    traits,
    class: className,
    style: styleAttr,
    ...rest
  }: BlobatarProps = $props();

  let opts = $derived({
    size,
    background,
    palette,
    hue,
    tone,
    normalize,
    contrast,
    title,
    expression,
    traits,
  });

  let src = $derived(animate ? "" : blobatarUri(seed, opts));

  // `animate` is passed through, never re-decided. An adapter re-expresses the
  // library and adds nothing to it, so an option the caller gave has to reach
  // core as they gave it — a ternary mapping anything-but-"always" onto
  // "hover" is the adapter answering a question the caller already answered,
  // and it would start silently rewriting the picture the moment `Animate`
  // gains a third member. See `CONTEXT.md`, "Adapter".
  let parts = $derived(
    animate ? _parts(seed, { ...opts, animate, travel }) : null,
  );

  // `rest` is the union of both modes' attributes, so it has to be narrowed to
  // the one whose element is about to be rendered before it can be spread. The
  // same cast the React and Solid adapters write inline; here it is a `$derived`
  // because a Svelte template cannot carry the assertion itself.
  let svgRest = $derived(rest as SVGAttributes<SVGSVGElement>);

  let img = $derived(rest as HTMLImgAttributes);

  let imgRest = $derived.by(() => {
    const { alt: _, ...forwarded } = img;
    return forwarded;
  });

  // The custom properties, serialized once. `style` is a string in Svelte
  // rather than an object, so the merge happens here and the caller's own
  // declarations go last — the same precedence the other adapters give them by
  // spreading `style` after `parts.vars`.
  let styleStr = $derived(
    [
      ...Object.entries(parts?.vars ?? {}).map(([k, v]) => `${k}:${v}`),
      ...(styleAttr ? [styleAttr] : []),
    ].join(";"),
  );
</script>

{#if parts}
  <!--
    `role` and `aria-hidden` below are one decision written as two attributes.
    With a `title` the markup carries a `<title>`, so this is a labelled image;
    without one it is decoration and should be skipped entirely — the same call
    `alt=""` makes on the `<img>` path. Never both: a `role="img"` that is also
    `aria-hidden` just contradicts itself. Svelte omits an attribute whose value
    is `undefined`, so the pair needs no conditional spread — and must not use
    one: a spread here silently swallows a `role` the caller passed in `rest`.
  -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    width={size}
    height={size}
    role={title ? "img" : undefined}
    aria-hidden={title ? undefined : true}
    class={className}
    style={styleStr}
    {...svgRest}
  >
    <!--
      Three real children rather than one `{@html}` blob, and the reason is the
      morph. Only the third varies at runtime — its class does, when the
      expression changes — and `{@html}` is all-or-nothing: had the root `<g>`
      stayed inside that string, every expression change would replace the whole
      subtree. A fresh element has no previous computed value, so no transition
      runs on it and every idle animation under it restarts from phase zero.

      The first two are siblings of the root rather than inside it: `<title>`
      names the element it is the first child of, so nesting it would label a
      `<g>` instead of this `<svg>`, and the backdrop must sit outside the
      hover-lift or the plate scales with the creature.
    -->
    {#if title}
      <title>{title}</title>
    {/if}
    {#if parts.bg}
      <path d={parts.bg.d} fill={parts.bg.fill} />
    {/if}
    <g class={parts.cls}>
      {@html parts.inner}
    </g>
  </svg>
{:else}
  <img
    {src}
    width={size}
    height={size}
    alt={img.alt ?? title ?? ""}
    class={className}
    style={styleAttr}
    {...imgRest}
  />
{/if}
