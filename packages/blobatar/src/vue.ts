/**
 * **Deprecated — moved to `@blobatar/vue`.**
 *
 * This entry point still works and still renders exactly what it always did.
 * It is frozen, not maintained in parallel: `@blobatar/vue` re-exports this
 * component, so the two are the same object and cannot drift.
 *
 * ```sh
 * bunx blobatar-codemod .
 * bun add @blobatar/vue
 * ```
 *
 * Removed in v3. Nothing else about the component changes when you move — same
 * props, same output, only the specifier.
 *
 * The reason it is still here rather than deleted: removing it is breaking, and
 * a break costs a major, and a major is how a consumer opts into their users'
 * faces changing (ADR-0008). Spending one on a repackaging would force every
 * consumer to take a new generation to get a new import path. So the two travel
 * separately, and this subpath waits for the major that was going to happen
 * anyway.
 */

import {
  computed,
  defineComponent,
  h,
  type CSSProperties,
  type PropType,
} from "vue";
import { serializeVars, type Animate, type Travel } from "./animate";
import { _parts, type BlobatarOptions } from "./blobatar";
import type { Palette } from "./color";
import type { Expression } from "./expression";
import type { TraitOverrides } from "./traits";
import { blobatarUri } from "./uri";

/**
 * Vue 3 adapter: the same two rendering modes as `blobatar/react`, behind the
 * same props.
 *
 * Static blobatars render as an `<img>`: a list of a few hundred is exactly the
 * case where you do not want extra DOM nodes per screen, and nothing here uses
 * `currentColor`, so inline SVG would buy nothing.
 *
 * Animated blobatars cannot. Content inside an `<img>` is an isolated,
 * non-interactive document — `:hover` never fires inside it and host-page CSS
 * cannot reach the shapes — so `animate` switches to inline SVG and costs
 * roughly a dozen nodes per blobatar. That trade is the reason animation is
 * opt-in rather than a default. See `react.tsx` for the full argument; none of
 * it is framework-specific.
 *
 * A render function rather than a template or an SFC: the same `setup()` then
 * works in `<script setup>`, in a plain `setup()` return, and under
 * `defineComponent` — no template compiler in the loop, and no SFC pre-step for
 * a consumer to configure. Vue's `h()` renders real SVG elements natively, so
 * there is no JSX runtime to externalize either.
 *
 * Everything not declared as a prop — `class`, `style`, `alt`, `aria-*`,
 * event listeners, `data-*` — flows through Vue's `attrs` onto whichever
 * element the mode renders, the same way `rest` spreads onto the DOM node in
 * the React adapter.
 */
export const Blobatar = defineComponent({
  name: "Blobatar",
  // Attrs are placed by hand on whichever element the mode renders; the
  // default automatic inheritance can only target one fixed element, so it is
  // off. The two branches handle their own merge.
  inheritAttrs: false,
  /**
   * One rule across the whole table: **a prop the caller omitted must arrive
   * as `undefined`**, so the core owns every default and the adapter states
   * none of them. Two of Vue's prop conveniences work against that, and both
   * are disarmed by declaring `default: undefined`:
   *
   * - A prop whose type list contains `Boolean` is cast to `false` when the
   *   caller omits it. That is right for a template flag and wrong for an
   *   option: `background` reaches the renderer as `opts.background ??
   *   style.background`, so an injected `false` reads as "transparent" rather
   *   than "unset" and the caller loses any way to ask for the style's own
   *   backdrop.
   * - Restating a core default here (`default: true`) puts it in two places
   *   that can drift apart, and drift between the adapters is the one thing
   *   `test/adapters.test.ts` exists to prevent.
   *
   * Declaring `default: undefined` is not the same as omitting `default`:
   * Vue checks for the key's presence, not its value, and the cast is skipped
   * on that check.
   */
  props: {
    /** Who the blobatar is for. A username, a display name, an email — any
     *  string, and the same string always renders the same blobatar. */
    name: { type: String, required: true },
    /** Emits width/height attributes. Omit to let CSS size it. */
    size: { type: Number },
    /** Overrides the default backdrop. `false` renders transparent. */
    background: {
      type: [Boolean, String] as PropType<BlobatarOptions["background"]>,
      default: undefined,
    },
    /** Overrides specific palette entries. */
    palette: { type: Object as PropType<Palette> },
    /** Locks the hue in degrees, so the name drives shape only. */
    hue: { type: Number },
    /**
     * Locks the tone as a 0–1 position in the swatch set, pale to ink.
     *
     * The swatches are banded with half-open edges, so an exact `1` sits on the
     * top edge rather than under it and falls back to the first swatch: `1`
     * renders what `0` renders. Reach for ink with `0.999`.
     */
    tone: { type: Number },
    /** Pins individual traits, so the name drives only what you leave out. */
    traits: { type: Object as PropType<TraitOverrides> },
    /** Applies NFC + trim + lowercase to the name. Default true. */
    normalize: { type: Boolean, default: undefined },
    /** Enforces the minimum contrast ratios. Default true. */
    contrast: { type: Boolean, default: undefined },
    /** Adds a `<title>` for screen readers. */
    title: { type: String },
    /**
     * Idle animation. Off by default; `"hover"` or `"always"`.
     *
     * Requires `import "blobatar/motion.css"`, and switches the rendering mode
     * to inline SVG — the same contract as `blobatar/react`.
     *
     * `Boolean` is in the type list so a template may write `:animate="true"`
     * as shorthand for `"hover"`. Note that the valueless form
     * (`<Blobatar animate />`) is *not* the same thing: Vue only casts a bare
     * attribute to `true` when `Boolean` comes first in the type list, and
     * here `String` does, so it arrives as `""` and reads as off.
     */
    animate: {
      type: [String, Boolean] as PropType<Animate | false>,
      default: undefined,
    },
    /**
     * Whole-figure directional travel. One of `"ltr" | "rtl" | "ttb" |
     * "btt"`, or `"seeded"` to let the name pick. Requires
     * `blobatar/motion.css`; ignored without `animate`.
     */
    travel: { type: String as PropType<Travel>, default: undefined },
    /** Which pose the blobatar holds. Import one from `blobatar/expression`. */
    expression: { type: Object as PropType<Expression> },
  },
  setup(props, { attrs }) {
    /**
     * The options object, rebuilt whenever any option changes.
     *
     * React's adapter memoizes on a serialized dependency string because its
     * hooks have no way to track each option individually. Vue does not need
     * that dance at all: `computed` tracks the props it reads by reference, so
     * an option that changed recomputes and one that did not invalidates
     * nothing. That is the correct granularity, which the serialized string
     * was approximating.
     */
    const opts = computed<BlobatarOptions>(() => ({
      size: props.size,
      background: props.background,
      palette: props.palette,
      hue: props.hue,
      tone: props.tone,
      normalize: props.normalize,
      contrast: props.contrast,
      title: props.title,
      expression: props.expression,
      traits: props.traits,
    }));

    const animated = computed(() => !!props.animate);

    const src = computed(() =>
      animated.value ? "" : blobatarUri(props.name, opts.value),
    );

    const parts = computed(() =>
      animated.value
        ? _parts(props.name, {
            ...opts.value,
            // `true` (template shorthand) means the same as "hover".
            animate: props.animate === "always" ? "always" : "hover",
            travel: props.travel || undefined,
          })
        : null,
    );

    return () => {
      const o = opts.value;
      const p = parts.value;

      if (p) {
        const { style: userStyle, ...svgAttrs } = attrs as {
          style?: CSSProperties | string;
          [key: string]: unknown;
        };
        // The seeded motion custom properties go on the same element the
        // stylesheet reads them from. Vue accepts style as a string or an
        // object; a string cannot be merged by spread, so it is concatenated —
        // user declarations last, so they win over the seed, exactly like the
        // object path and like React's `{ ...vars, ...style }`.
        const vars = p.vars ?? {};
        const style =
          typeof userStyle === "string"
            ? serializeVars(vars) + (userStyle ? `;${userStyle}` : "")
            : { ...vars, ...(userStyle ?? {}) };

        return h(
          "svg",
          {
            xmlns: "http://www.w3.org/2000/svg",
            viewBox: "0 0 100 100",
            ...(o.size !== undefined ? { width: o.size, height: o.size } : {}),
            // With a `title` the markup carries a `<title>`, so this is a
            // labelled image; without one it is decoration and should be
            // skipped entirely — the same call `alt=""` makes on the `<img>`
            // path. Never both: a `role="img"` that is also `aria-hidden`
            // just contradicts itself.
            role: o.title ? "img" : undefined,
            "aria-hidden": o.title ? undefined : true,
            style,
            // Attrs land last, so the caller wins — the same precedence as
            // `{...svgRest}` in the React adapter, and the same as the `<img>`
            // branch below. Spread first, they would instead be overwritten by
            // the values derived from props: a caller-supplied `role` would be
            // dropped outright rather than overriding the derived one, and the
            // two rendering modes would disagree about who wins. `style` is
            // already destructured out above and merged by hand.
            ...svgAttrs,
          },
          [
            /*
             * Three real children rather than one innerHTML blob, for the same
             * reason as the React adapter: `<title>` names the element it is
             * the first child of, the backdrop must sit outside the hover-lift
             * or the plate scales with the creature, and only the root `<g>`'s
             * class varies at runtime.
             *
             * Vue needs no memoized `{__html}` object here. The VNode diff
             * compares prop values, and `inner` never varies with the
             * expression — so an expression change is attribute writes on the
             * root and the DOM below survives, which is what the morph needs
             * to exist at all.
             */
            o.title ? h("title", o.title) : null,
            p.bg ? h("path", { d: p.bg.d, fill: p.bg.fill }) : null,
            h("g", { class: p.cls, innerHTML: p.inner }),
          ],
        );
      }

      const { alt, ...imgAttrs } = attrs as {
        alt?: string;
        [key: string]: unknown;
      };
      return h("img", {
        src: src.value,
        ...(o.size !== undefined ? { width: o.size, height: o.size } : {}),
        alt: alt ?? o.title ?? "",
        ...imgAttrs,
      });
    };
  },
});
