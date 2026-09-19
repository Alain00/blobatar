import { useEffect, useRef, useState } from "react";
import { Blobatar } from "@blobatar/react";
import type { BlobatarOptions } from "blobatar";
import {
  happy,
  idle,
  love,
  mad,
  sad,
  scared,
  shy,
  sick,
  sleepy,
  smug,
  surprised,
  thinking,
  unsure,
  wink,
  type Expression,
} from "blobatar/expression";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PoseTile } from "@/components/ui/pose-tile";
import { ChevronIcon } from "@/components/ui/chevron";
import { Snippet } from "@/components/ui/snippet";
import { SHAPES, type ShapeOption } from "@/shapes";
import { Install } from "@/components/ui/install";
import { Caret, FrameworkMenu } from "@/components/ui/framework-menu";
import {
  attrExpr,
  attrString,
  close,
  comment,
  exprClose,
  exprOpen,
  infoFor,
  installFor,
  isManager,
  MANAGERS,
  SHADCN_FILE,
  type Manager,
  wrap,
  type Framework,
} from "@/frameworks";
import { EggMark, eggFor } from "@/eggs";
import { cn } from "@/lib/utils";
import { useGaze } from "@blobatar/react/gaze";
import {
  createParser,
  debounce,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

const BACKGROUNDS = ["none", "squircle", "circle", "square"] as const;
type Background = (typeof BACKGROUNDS)[number];

/**
 * Eight stops around the wheel plus an auto chip.
 *
 * `hue` is genuinely tri-state — unset means the seed drives color, which is
 * the library's default and the more interesting behaviour. A bare 0-360 slider
 * has nowhere to express "unset", and implies a precision nobody tuning a
 * landing page wants.
 */
const HUES = [12, 40, 78, 140, 190, 225, 275, 320] as const;

/**
 * One silhouette option: its name and the trait position that selects it.
 */
type Shape = ShapeOption;

/**
 * The roster, paired with the identifier you would import to get it.
 *
 * The name is not decoration: it is what the snippet writes into both the
 * import and the prop, so the picker and the generated code cannot drift. That
 * is also why `idle` is in the list rather than being a separate "off" control
 * — it is a real expression with a real export, and it is the one the snippet
 * omits, because omitting `expression` is what `idle` means.
 */
const EXPRESSIONS = [
  { name: "idle", value: idle },
  { name: "happy", value: happy },
  { name: "sad", value: sad },
  { name: "mad", value: mad },
  { name: "surprised", value: surprised },
  { name: "wink", value: wink },
  { name: "sleepy", value: sleepy },
  { name: "smug", value: smug },
  { name: "unsure", value: unsure },
  { name: "scared", value: scared },
  { name: "love", value: love },
  { name: "shy", value: shy },
  { name: "sick", value: sick },
  { name: "thinking", value: thinking },
] as const;

type ExpressionOption = (typeof EXPRESSIONS)[number];

function parseAsNamedObject<T extends { name: string }>(list: readonly T[]) {
  return createParser({
    parse(query) {
      const item = list.find((p) => p.name === query);
      return item ?? null;
    },
    serialize(item) {
      return item.name;
    },
    eq: (a, b) => a.name === b.name,
  });
}

const controlsSearchParams = {
  name: parseAsString.withDefault("alain00"),
  background: parseAsStringLiteral(BACKGROUNDS).withDefault("none"),
  hue: parseAsNumberLiteral(HUES),
  expression: parseAsNamedObject(EXPRESSIONS).withDefault(EXPRESSIONS[0]),
  shape: parseAsNamedObject(SHAPES),
};

function useControls() {
  return useQueryStates(controlsSearchParams);
}

/**
 * How many of the roster the panel shows without being asked.
 *
 * Four, because the tile grid is four across and a fifth tile would sit alone on
 * a second row — which reads as an accident rather than as a row. The rest live
 * behind the `+N more` row, which counts them itself so the roster can grow
 * without a number going stale here. The split is not arbitrary: these four are the original
 * roster and they span the axis the whole feature turns on (eyes up, eyes flat,
 * eyes small, and the one that spends colour). Someone who opens this panel and
 * reads no further has still seen what an expression *is*.
 *
 * The order is the roster's, not a ranking — `EXPRESSIONS` is the single list, and the
 * panel takes a prefix of it rather than keeping a second one that can drift.
 */
const SHOWN = 4;
const MORE = EXPRESSIONS.slice(SHOWN);

/**
 * How long a reaction is held before it releases back to the picked expression.
 *
 * Measured from the click, so it *contains* the morph in rather than following
 * it: at 300ms in and 400ms back the face sits at full strength for the
 * remainder, and the click lasts about 2s end to end. Long enough to register
 * as an expression rather than a flicker, short enough that a second click
 * never feels blocked.
 */
const HOLD = 1500;

/**
 * The `lg` breakpoint, read in JS.
 *
 * Which side the tuning panel opens on is a layout decision, and layout
 * decisions belong in CSS — but Radix positions the panel in JS against a
 * measured rect, so there is no class to hand it. Matching the same 1024px
 * the grid switches at keeps the two from disagreeing.
 */
function useWide() {
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return wide;
}

/**
 * The hero's generator, in whichever framework you are reading.
 *
 * Four axes rather than the editor's twenty, and otherwise the same job — so
 * the spellings come from the same table (`@/frameworks`) rather than being
 * decided again here. Two generators is a deliberate split; two answers to
 * "how does Vue write a bound prop" would not be.
 *
 * Exported for `Hero.test.ts` and for nothing else. The editor's equivalent got
 * a module of its own on the grounds that a generator inside a component is
 * testable only by rendering one; that is true of a *private* one, and a named
 * export is the cheaper half of the same fix. It stays here because its inputs
 * — `Background`, `ExpressionOption`, `Shape` — are this file's, and moving four types out to
 * follow one function would be the larger change, not the smaller one.
 */
export function snippet(
  fw: Framework,
  seed: string,
  background: Background,
  hue: number | null,
  expression: ExpressionOption,
  shape: Shape | null,
) {
  const posed = expression.value !== idle;
  const { pkg, flavor, native } = infoFor(fw);

  /*
    This snippet always animates, which is the one axis it does not offer a
    choice about, so React Native's difference lands here rather than being
    avoidable. There, the loops are worklets in a second component behind a
    second entry point, the stylesheet does not exist, and `animate` is a
    boolean the app drives because the platform has no `:hover` to key off.
    `src/editor/snippet.ts` carries the long version of the same note.
  */
  const tag = native ? "AnimatedBlobatar" : "Blobatar";

  const imports = [
    native
      ? `import { AnimatedBlobatar } from "${pkg}/animated";`
      : `import { Blobatar } from "${pkg}";`,
  ];
  // Expressions are values, not strings, and they are core's rather than any
  // adapter's — so this import is the one line of the six that is identical in
  // all six.
  if (posed) imports.push(`import { ${expression.name} } from "blobatar/expression";`);
  if (!native) imports.push(`import "blobatar/motion.css";`);

  // Only what differs from the defaults. A snippet that restates every default
  // reads as configuration you are obliged to supply, which is the opposite of
  // what a one-prop library wants to advertise.
  const props = [attrString(flavor, "name", seed || "blobatar")];
  // Except this one, which has no default to differ from: React Native has no
  // CSS box for a size to be inherited from, so the prop is required and a
  // snippet without it pastes into an app and renders nothing.
  if (native) props.push(attrExpr(flavor, "size", "48"));
  if (shape) props.push(attrExpr(flavor, "traits", `{ shape: ${shape.at} }`));
  if (background !== "none") props.push(attrString(flavor, "background", background));
  if (hue !== null) props.push(attrExpr(flavor, "hue", String(hue)));
  if (posed) props.push(attrExpr(flavor, "expression", expression.name));
  props.push(native ? "animate" : attrString(flavor, "animate", "hover"));

  // The one line here that cannot be read off the code. `0.885` is a position in
  // a range, not a measurement, and nothing about it says "cloud" — so the name
  // goes above the element, where a comment is legal. Inside the attribute list
  // it would not be: no flavor here has a line comment between props. Which
  // comment it is belongs to the flavor — `//` renders as text in a template.
  const note = shape ? [comment(flavor, `shape: ${shape.name}`)] : [];

  return wrap(flavor, imports, [
    ...note,
    `<${tag}`,
    ...props.map((p) => `  ${p}`),
    close(flavor),
  ]);
}

/**
 * The same four axes, as the shadcn item's usage.
 *
 * A separate emitter rather than a sixth flavor of the one above, because
 * nothing it shares with the adapters survives the change of subject: the
 * import is the consumer's own alias, the element takes a `src` no adapter has,
 * and every tuned option moves one level down into a `blobatar` prop. A branch
 * inside `snippet` would have been five conditionals in a function whose whole
 * shape is "spell these props for this flavor".
 *
 * JSX only, and not by omission — the wrapper is React. `installFor` is what
 * decides this snippet is on screen, and it returns the shadcn command for
 * every framework, which is a small dishonesty the picker's disappearance
 * covers: under this manager the framework axis has no meaning to express.
 */
export function shadcnSnippet(
  seed: string,
  background: Background,
  hue: number | null,
  expression: ExpressionOption,
  shape: Shape | null,
) {
  const posed = expression.value !== idle;

  // The filename with its extension dropped, not `SHADCN_FILE` itself — that
  // constant is the label above the code box, and an import specifier that
  // carried `.tsx` would not resolve in any of the bundlers this lands in.
  const from = SHADCN_FILE.replace(/\.tsx$/, "");
  const imports = [`import { Blobatar } from "@/components/ui/${from}";`];
  if (posed) imports.unshift(`import { ${expression.name} } from "blobatar/expression";`);
  imports.push(`import "blobatar/motion.css";`);

  // Everything the adapters take as props, one level down. `animate` is always
  // here, so the object is never empty and never needs a conditional.
  const opts: string[] = [];
  if (shape) opts.push(`traits: { shape: ${shape.at} },`);
  if (background !== "none") opts.push(`background: "${background}",`);
  if (hue !== null) opts.push(`hue: ${hue},`);
  if (posed) opts.push(`expression: ${expression.name},`);
  opts.push(`animate: "hover",`);

  return wrap("jsx", imports, [
    ...(shape ? [comment("jsx", `shape: ${shape.name}`)] : []),
    `<Blobatar`,
    `  ${attrString("jsx", "name", seed || "blobatar")}`,
    // The whole point of the wrapper: a real picture when there is one, the
    // blobatar when there is not. A snippet that omitted it would be the
    // adapter's usage with a longer import.
    `  src={user.avatarUrl}`,
    `  ${exprOpen("jsx", "blobatar")}`,
    ...opts.map(line => `    ${line}`),
    `  ${exprClose("jsx")}`,
    close("jsx"),
  ]);
}

export function Hero() {
  const [{ name: seed, background, hue, expression, shape }, setControls] =
    useControls();

  /**
   * Which adapter the snippet is written in.
   *
   * The hero's four axes are about the blobatar; this one is about you, and it
   * is the only control here that changes no pixel of the preview. It earns its
   * place anyway: the page's argument is "this is four lines you can paste",
   * and that argument is only made to a React reader if the four lines are the
   * only ones on offer.
   */
  const [fw, setFw] = useState<Framework>("react");
  /**
   * How you install it, which under `shadcn` also decides what you import.
   *
   * Separate state from `fw` rather than folded into it: the two are genuinely
   * independent for three of the four values, and a reader who picked pnpm and
   * then picked svelte expects to still be on pnpm.
   */
  const [pm, setPm] = useState<Manager>("bun");
  /** Whether the framework list is open. Controlled — see `FrameworkMenu`. */
  const [picking, setPicking] = useState(false);

  // Under shadcn the framework axis has nothing to say — the item is React, and
  // the file it installs is the consumer's own. Hoisted so the three places
  // that branch on it read as one decision rather than three.
  const shadcn = pm === "shadcn";

  /**
   * A reaction is a temporary override of the picked expression, not a replacement
   * for it — clicking the big blobatar borrows the face and gives it back. Held
   * separately for exactly that reason: `null` here means "show what the picker
   * says", so the release is a single `setBurst(null)` and the picker never has
   * to be restored to a value it was already holding.
   */
  const [burst, setBurst] = useState<Expression | null>(null);
  const release = useRef<ReturnType<typeof setTimeout>>(null);
  const wide = useWide();

  /**
   * The nested panel is controlled rather than left to Radix, for one reason:
   * picking an expression in it has to close it. An uncontrolled popover would stay
   * open over the face it just changed, which is the one thing the panel is in
   * the way of.
   */
  const [more, setMore] = useState(false);

  /**
   * A few names render as themselves instead of as a hash — see `@/eggs`.
   *
   * Only the face is swapped. The panel keeps tuning a real blobatar and the
   * snippet keeps printing the code that produces one, because both are claims
   * about the library and the library has no eggs in it — the same name in a
   * consumer's app renders a blob, and a snippet that implied otherwise would be
   * the one part of this joke that costs somebody an afternoon.
   */
  const egg = eggFor(seed);

  /**
   * A mark has no expression to burst into, so the click gets its own reaction.
   *
   * A flag rather than a timer, unlike `burst`: the animation itself is the
   * duration, and `onAnimationEnd` is a more honest end than a number that has
   * to be kept in sync with the keyframes.
   */
  const [nudge, setNudge] = useState(false);

  useEffect(() => () => clearTimeout(release.current ?? undefined), []);

  /**
   * The gaze layer: this blobatar's eyes follow the pointer. See
   * `@blobatar/react/gaze` for the hook and `blobatar/gaze` for what it drives.
   * The one decision that is actually this page's is the excursion, and it is
   * the option below rather than a rule in `styles.css`.
   *
   * It used to be the rule, and the rule was silently winning. `useGaze` writes
   * `--mo-track-travel` inline on the element it is given, which is the
   * `<svg>`, and `gaze.css` reads it on the `.mo-eyes` group inside. A
   * `.hero-blobatar .mo-eyes { --mo-track-travel: … }` matches that group
   * directly, and a declaration on the element always beats a value inherited
   * from an ancestor, so the eyes never saw what the hook wrote and `travel`
   * did nothing at all. One owner, here.
   *
   * The pointer gate the rule used to sit behind is not lost with it. The
   * driver watches `(hover: hover) and (pointer: fine)` itself and only
   * attaches while it matches, so on a touch screen `--mo-track-x/y` stay at
   * their registered `0` and the excursion has nothing to multiply.
   *
   * In viewBox units, so this is 3% of a face 100 units across rather than
   * three screen pixels. The idle saccade's widest stop is a median 1.4 units,
   * so a little over twice an idle glance. It has to be: that one is a rove and
   * this is a deliberate look, carried by two small capsules.
   *
   * No `egg` key any more, and that is the hook earning its place rather than a
   * tidy-up. This used to be an effect keyed on `egg` because a mark takes the
   * face's slot entirely, so the ref is null on those renders and there is
   * nothing to drive — a dependency that had to be remembered, and that says
   * nothing about gaze to anyone reading it. `useGaze` hands back a callback
   * ref, so the driver's life follows the element's exactly and a blobatar that
   * is swapped out simply detaches.
   *
   * Nothing else in the render can invalidate it: it writes only
   * `--mo-track-*`, which React never touches, so an expression change, a hue
   * change or a remount of the SVG's contents all leave it running.
   *
   * The aim is asked for and not assumed. A driver is armed by mounting and
   * aimed by a target, so following the cursor — the thing this page wants and
   * the thing the layer is named for — is a thing this page says out loud. It
   * never changes here, so it is the option rather than the function: this
   * blobatar watches the pointer for its whole life and has no second thing to
   * look at.
   */
  const { ref: face } = useGaze({ travel: 12, lookAt: "pointer" });

  const shown = burst ?? expression.value;
  /** Whether the picked expression is one of the ones the row hides. */
  const extra = MORE.some((p) => p.name === expression.name);
  const tuned = background !== "none" || hue !== null || expression.value !== idle || shape !== null;

  /**
   * The burst pattern the library documents: an expression is a latched state,
   * so the consumer owns the timer that puts it back. This is that consumer.
   *
   * Drawn from the pool minus whatever is currently showing, because a click
   * that re-picks the same expression looks like a click that did nothing.
   */
  const react = () => {
    const pool = EXPRESSIONS.filter((p) => p.value !== shown && p.value !== idle);
    setBurst(pool[Math.floor(Math.random() * pool.length)]!.value);
    clearTimeout(release.current ?? undefined);
    release.current = setTimeout(() => setBurst(null), HOLD);
  };

  const pick = (p: ExpressionOption) => {
    clearTimeout(release.current ?? undefined);
    setBurst(null);
    setControls({ expression: p });
  };

  const opts: BlobatarOptions = {
    background: background === "none" ? false : background,
    hue: hue ?? undefined,
    expression: shown,
    // Sparse on purpose: pinning `shape` leaves every other trait — eye gap,
    // body ratio, tilt — coming from the name, so picking a cloud still gives
    // you *your* cloud rather than the same cloud everybody else gets.
    traits: shape ? { shape: shape.at } : undefined,
  };

  return (
    /*
      One viewport, two columns. The left column is the toy and the right one is
      the payoff — you tune a face and read the code that produces it, without
      the page moving. Below `lg` they stack in that same order, so the snippet
      lands directly under the thing it describes.
    */
    <section className="relative mx-auto flex min-h-svh max-w-6xl flex-col justify-center gap-14 px-6 py-12 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-16">
      {/*
        The two places to go, then the two places to look: pages first, marks
        after, split by a hairline.

        The pages are here because they were reachable only from the footer,
        which is four sections down. Someone who arrives, tunes a face and
        wants the components or the editor should not have to scroll past the
        whole argument to find out they exist.

        Words for the pages and marks for the accounts, deliberately. A GitHub
        glyph is read faster than the word and an internal page has no glyph
        anybody knows, so spelling one and drawing the other is what makes the
        row scan in one pass. It does make this a small navigation bar, which
        the page did not have before and now earns: it has five pages.

        Absolute to the hero rather than fixed to the viewport, which is
        unchanged. Pinned to the window it would follow you down three more
        sections with nothing to belong to; here it scrolls away with the hero,
        and `right-6` matches the section's own padding so it lands on the same
        edge as the snippet column below.
      */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-1 lg:top-8">
        <HeaderLink href="/components">Components</HeaderLink>
        <HeaderLink href="/editor">Editor</HeaderLink>
        <span className="bg-line mx-1.5 h-4 w-px" aria-hidden="true" />
        <SocialLink href="https://github.com/Alain00/blobatar" label="blobatar on GitHub">
          <GitHubIcon />
        </SocialLink>
        <SocialLink href="https://x.com/alain_0012" label="@alain_0012 on X">
          <XIcon />
        </SocialLink>
      </div>

      <div className="flex flex-col items-center gap-10 lg:items-start">
        <div className="w-full">
          <h1 className="text-[clamp(3rem,10vw,7.5rem)] leading-[0.82] font-medium tracking-[-0.055em]">
            blobatar
          </h1>

          <p className="text-muted mt-5 max-w-md text-balance text-base leading-relaxed">
            Deterministic geometric blobatars from any string. No dependencies,
            about 4.4&nbsp;KB.
          </p>
        </div>

        {/*
          Question and answer are one unit, so they sit closer to each other
          than either does to the wordmark above them. Equal gaps read as three
          unrelated blocks; this reads as a sentence with its reply.

          The popover root spans both, because the panel is anchored to the
          face rather than to the button that opens it — see the anchor below.
        */}
        <Popover>
          <div className="flex w-full flex-col items-center gap-6 lg:items-start">
            {/*
              A sentence, not a form. The question is the label — literally, via
              `htmlFor`, so clicking it focuses the field — and the field is a
              dashed blank inside it, sized to whatever you have typed. That is the
              one line of the page that has to say "this is about you", and a boxed
              input with a placeholder says "this is about data entry".

              The field is still a real `<input>`: contenteditable would have cost
              the caret, the mobile keyboard, autofill suppression and undo, and
              bought nothing a grid cell cannot do.
            */}
            <div className="flex w-full max-w-md flex-wrap items-baseline justify-center gap-x-3 gap-y-2 text-xl sm:text-2xl lg:justify-start">
              {/*
                An invitation, not an interrogation. "And your name is?"
                collects a field; this proposes doing something together, and
                names the thing you get at the end of it — which is also the
                only place on the page that says a blobatar is *yours*.
              */}
              <label htmlFor="seed" className="text-muted cursor-text tracking-tight">
                Let’s find your blobatar
              </label>

              {/*
                Two elements in one grid cell: the input, and an invisible copy of
                what it holds. The copy is what has width, so the blank grows and
                shrinks with the name instead of reserving a fixed run of dashes.
                `whitespace-pre` keeps a trailing space measurable — without it the
                caret walks off the end of the underline.
              */}
              <span
                className={cn(
                  "inline-grid max-w-full overflow-hidden border-b border-dashed pb-1 transition-colors duration-200",
                  // The dashed rule is the entire affordance now — there is no box
                  // and no caret until you are in it — so it has to answer a
                  // hovering pointer. Three states: at rest, under the pointer,
                  // and focused.
                  "border-line hover:border-muted focus-within:border-ink",
                )}
              >
                <span
                  aria-hidden="true"
                  className="col-start-1 row-start-1 px-1 whitespace-pre invisible tracking-tight"
                >
                  {seed || "someone"}
                </span>
                <input
                  id="seed"
                  value={seed}
                  // The nudge is cleared on every keystroke rather than only on
                  // the ones that change which mark is showing: a flag left set
                  // from a previous name lands the click reaction on the reveal
                  // of the next one, and the two transforms fight.
                  onChange={(e) => {
                    setControls(
                      { name: e.target.value },
                      {
                        limitUrlUpdates: e.target.value
                          ? debounce(250)
                          : undefined,
                      },
                    );
                    setNudge(false);
                  }}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="someone"
                  // `size={1}`, and it is load-bearing. Both elements share one
                  // grid cell, so the column is as wide as the widest of them —
                  // and an input's default intrinsic width is about 20 characters,
                  // which is what would set the width instead of the name. Sized
                  // to one character it contributes nothing and `w-full` stretches
                  // it back over the measured copy.
                  size={1}
                  className={cn(
                    "col-start-1 row-start-1 w-full min-w-0 bg-transparent px-1 text-center",
                    "tracking-tight outline-none",
                    "placeholder:text-muted/40",
                  )}
                />
              </span>

              <PopoverTrigger
                  aria-label="Blobatar options"
                  className={cn(
                    "text-muted hover:text-ink hover:bg-line/50 -mb-1 self-center rounded-lg p-1.5",
                    "transition-colors duration-150",
                    // Two states worth showing on a control that hides everything
                    // behind it: open, because the panel is portalled and the
                    // button would otherwise look untouched while it hangs off
                    // it; and tuned, because a closed panel is the only place the
                    // page says that this blobatar is no longer the default one.
                    "data-[state=open]:text-ink data-[state=open]:bg-line/50",
                    tuned && "text-ink",
                  )}
                >
                <SlidersIcon />
              </PopoverTrigger>
            </div>

            {/*
              Below the question, because that is the order it happens in: you are
              asked, you answer, the face is what comes back. With the blobatar above
              the input the page showed you the answer before it had asked, which
              is what made the column read as three unrelated things stacked.

              `animate="always"` puts this on the inline-SVG path — roughly a dozen
              DOM nodes instead of one <img>. That is the trade the library
              documents, and a single hero blobatar is exactly the case it is meant
              for.

              A real button, not a click handler on the SVG. The blobatar keeps its
              own `role="img"` and name — the expression is decorative and
              deliberately invisible to assistive tech — so the button is what
              carries the action, and its label describes what clicking *does*
              rather than what the face is currently doing.

              It is also the popover's anchor. A panel that positions itself off
              the little icon has to open *somewhere* relative to a point inside
              the sentence, and every direction from there crosses the blobatar at
              one width or another — which is fatal for a control surface whose
              whole job is changing what the blobatar looks like. Anchored to the
              face instead, "beside it" and "under it" are directions that mean
              what they say.
            */}
            <PopoverAnchor asChild>
              <button
                type="button"
                onClick={egg ? () => setNudge(true) : react}
                aria-label={egg ? "Nudge" : "React"}
                className="rounded-full"
              >
                {/*
                  Same slot, same size class, either way — the sentence above it
                  and the snippet beside it must not move when a mark takes the
                  face's place, or the egg stops being a surprise and becomes a
                  layout shift.

                  Keyed on which name matched, so typing your way from one egg to
                  another remounts and replays the reveal — a different creature
                  arriving, rather than the same one changing colour.
                */}
                {egg ? (
                  <EggMark
                    key={egg.id}
                    egg={egg}
                    title={seed.trim()}
                    nudge={nudge}
                    onSettled={() => setNudge(false)}
                    className="size-[min(26vmin,13rem)]"
                  />
                ) : (
                  <Blobatar
                    ref={face}
                    name={seed || " "}
                    animate="always"
                    {...opts}
                    title={`Blobatar for ${seed}`}
                    // `hero-blobatar` is a hook for one rule in `styles.css`, which
                    // gives this blobatar back the pointer reaction the page turns
                    // off everywhere else.
                    className="hero-blobatar size-[min(26vmin,13rem)]"
                  />
                )}
              </button>
            </PopoverAnchor>

            {/*
              Beside the face on a wide screen, where the gap between the columns
              is empty; under it on a narrow one, where nothing is beside it and
              the only thing worth covering is the snippet. Both are measured
              from the blobatar, so neither lands on top of it.
            */}
            <PopoverContent
              side={wide ? "right" : "bottom"}
              align={wide ? "start" : "center"}
              sideOffset={wide ? 28 : 20}
              collisionPadding={16}
              // Seven shape tiles made this panel tall enough to outgrow a
              // short window. Radix measures the space it actually has and
              // publishes it as a custom property; capping to that turns an
              // overflow into a scroll instead of a clipped hue row.
              className="max-h-[var(--radix-popover-content-available-height)] w-80 overflow-y-auto"
            >
              <div className="flex flex-col gap-5">
                {/*
                  Shape next: it is the trait that decides what creature this
                  is, and every control under it decorates that decision.

                  Same argument as the expression row for showing the thing
                  rather than naming it — "nub" and "droplet" are words for
                  silhouettes nobody has seen yet. Seeded with the current name,
                  so the row is your blobatar wearing each of them.
                */}
                <Field label="shape">
                  <div className="grid grid-cols-4 gap-1" role="group" aria-label="Shape">
                    {/*
                      `auto` is a tile rather than a pill because it is a
                      seventh option of the same kind — it shows the blobatar
                      the name produces on its own, which is exactly what
                      picking it gives you back.
                    */}
                    <ShapeTile
                      label="auto"
                      seed={seed}
                      opts={{ ...opts, traits: undefined }}
                      selected={shape === null}
                      onClick={() => setControls({ shape: null })}
                    />
                    {SHAPES.map((s) => (
                      <ShapeTile
                        key={s.name}
                        label={s.name}
                        seed={seed}
                        opts={{ ...opts, traits: { shape: s.at } }}
                        selected={shape?.name === s.name}
                        onClick={() => setControls({ shape: s })}
                      />
                    ))}
                  </div>
                </Field>

                {/*
                  The expression picker is the same blobatar wearing each pose,
                  not a select. A pose is a *look*, and the only honest label
                  for a look is the look — "mad" on two capsule eyes means
                  nothing until you have seen it. Seeded identically to the
                  hero, so the row reads as one creature's range rather than
                  four strangers.
                */}
                <Field label="expression">
                  <div className="flex flex-col gap-1">
                    <div className="grid grid-cols-4 gap-1" role="group" aria-label="Expression">
                      {EXPRESSIONS.slice(0, SHOWN).map((p) => (
                        <PoseTile
                          key={p.name}
                          name={p.name}
                          expression={p.value}
                          seed={seed}
                          opts={opts}
                          selected={expression.name === p.name}
                          onClick={() => pick(p)}
                        />
                      ))}
                    </div>

                    {/*
                      A panel opened from a panel, which is a shape worth being
                      careful with — nested layers are where dismissal usually
                      breaks. Radix stacks them, so escape and an outside click
                      each close the innermost one first and the options panel
                      survives being browsed. It is deliberately *not* modal:
                      the hero blobatar behind both panels is the thing being
                      tuned, and locking the page away from it while choosing a
                      face would be the one interaction this page cannot afford.

                      A row rather than a fifth tile: the grid is four across,
                      and a lone tile on a second row reads as an accident.

                      The label carries the current expression when the selection came
                      from behind it. Otherwise picking `wink` would leave four
                      unselected tiles and a `+6 more` that says nothing — the
                      panel would be the only place on the page that cannot tell
                      you what it is showing.
                    */}
                    <Popover open={more} onOpenChange={setMore}>
                      <PopoverTrigger
                        aria-label={`${MORE.length} more expressions`}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-xl py-1.5",
                          "font-mono text-[0.65rem] lowercase transition-colors duration-150",
                          extra
                            ? "bg-line/70 text-ink"
                            : "text-muted hover:bg-line/30 hover:text-ink",
                        )}
                      >
                        {extra ? `${expression.name} · ${MORE.length} more` : `+${MORE.length} more`}
                        <ChevronIcon down={!wide} />
                      </PopoverTrigger>

                      {/*
                        Anchored to the row it opens from, and sided the same way
                        the options panel is — beside it on a wide screen, under
                        it on a narrow one. Radix flips either when the viewport
                        says otherwise, which is what stops a second panel from
                        walking off the right edge on a 1024px window.
                      */}
                      <PopoverContent
                        side={wide ? "right" : "bottom"}
                        align={wide ? "start" : "center"}
                        sideOffset={12}
                        collisionPadding={16}
                        className="max-h-[var(--radix-popover-content-available-height)] w-72 overflow-y-auto"
                      >
                        <div
                          className="grid grid-cols-4 gap-1"
                          role="group"
                          aria-label="All expressions"
                        >
                          {/*
                            The whole roster, not just the ones behind the row.
                            A picker that
                            hides what you already chose makes you close it to
                            find out whether you chose it.
                          */}
                          {EXPRESSIONS.map((p) => (
                            <PoseTile
                              key={p.name}
                              name={p.name}
                              expression={p.value}
                              seed={seed}
                              opts={opts}
                              selected={expression.name === p.name}
                              onClick={() => {
                                pick(p);
                                setMore(false);
                              }}
                            />
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </Field>

                <Field label="background">
                  <Segmented
                    type="single"
                    value={background}
                    onValueChange={(v) => v && setControls({ background: v as Background })}
                    aria-label="Background"
                  >
                    {/*
                      Tighter than the default: four options have to fit the
                      panel's width on one pill, and a pill that wraps stops
                      being one.
                    */}
                    <SegmentedItem value="none" className="px-3">
                      none
                    </SegmentedItem>
                    <SegmentedItem value="squircle" className="px-3">
                      squircle
                    </SegmentedItem>
                    <SegmentedItem value="circle" className="px-3">
                      circle
                    </SegmentedItem>
                    <SegmentedItem value="square" className="px-3">
                      square
                    </SegmentedItem>
                  </Segmented>
                </Field>

                <Field label="hue">
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    role="group"
                    aria-label="Hue"
                  >
                    <button
                      onClick={() => setControls({ hue: null })}
                      aria-pressed={hue === null}
                      className={cn(
                        "border-line rounded-full border px-2.5 py-0.5 text-[0.7rem] lowercase transition-colors",
                        hue === null
                          ? "bg-ink text-ground border-ink"
                          : "text-muted hover:text-ink",
                      )}
                    >
                      auto
                    </button>
                    {HUES.map((h) => (
                      <button
                        key={h}
                        onClick={() => setControls({ hue: h })}
                        aria-label={`Hue ${h} degrees`}
                        aria-pressed={hue === h}
                        style={{ background: `oklch(0.72 0.15 ${h})` }}
                        className={cn(
                          "size-5 rounded-full transition-transform duration-150",
                          hue === h
                            ? "ring-ink ring-offset-raised scale-110 ring-2 ring-offset-2"
                            : "hover:scale-110",
                        )}
                      />
                    ))}
                  </div>
                </Field>
              </div>
            </PopoverContent>
          </div>
        </Popover>
      </div>

      {/*
        The snippet is the whole argument of the page: whatever you just tuned
        is four lines you can paste. It regenerates on every control, so there
        is never a step where you have to work out which prop you changed.
      */}
      <div className="flex w-full min-w-0 flex-col gap-6">
        {/*
          Directly above the snippet, because the two are one instruction in the
          order you carry it out: install the package, then paste the code that
          imports it. It used to sit in the closing section — past a viewport of
          hero and two of wall — which put the page's only call to action behind
          the entire page.

          `self-start` is load-bearing on both: a flex column stretches its
          children, and a command pill as wide as the snippet stops reading as a
          thing you press.

          The strip sits above the command rather than beside it, and lighter
          than it: it picks which of four commands you are being shown, so it
          has to be read first and weigh less than the thing it labels.
        */}
        <div className="flex flex-col gap-3">
          <Segmented
            type="single"
            value={pm}
            onValueChange={v => v && isManager(v) && setPm(v)}
            aria-label="Install with"
            className="self-start"
          >
            {MANAGERS.map(m => (
              <SegmentedItem key={m} value={m} className="px-3">
                {m}
              </SegmentedItem>
            ))}
          </Segmented>

          <Install command={installFor(fw, pm)} className="self-start" />
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-muted flex items-baseline justify-between gap-4 text-xs lowercase">
            <span>your config</span>
            {/*
              The picker sits with the filename rather than with the tuning
              controls above, and that is the placement doing the explaining:
              both of these describe the *file*, not the creature. The filename
              follows the framework for the same reason — `.svelte` is how you
              know the code below changed language.
            */}
            <span className="flex items-baseline gap-3">
              {/*
                Gone rather than disabled under shadcn. A greyed picker is a
                control you are being refused; an absent one is an axis this
                install does not have — which is the true statement, since the
                item is React and the file it writes is yours.
              */}
              {!shadcn && (
                <FrameworkMenu
                  value={fw}
                  onChange={setFw}
                  open={picking}
                  onOpenChange={setPicking}
                  align="end"
                >
                  <button
                    type="button"
                    onClick={() => setPicking(open => !open)}
                    aria-label={`Framework: ${fw}`}
                    className={cn(
                      "hover:text-ink flex items-center gap-1.5 rounded-full px-2 py-1",
                      "hover:bg-raised/60 -mx-2 transition-colors duration-150",
                      picking && "text-ink",
                    )}
                  >
                    {fw}
                    <Caret className={cn(picking && "rotate-180")} />
                  </button>
                </FrameworkMenu>
              )}
              <span className="font-mono normal-case">
                {shadcn ? SHADCN_FILE : infoFor(fw).file}
              </span>
            </span>
          </div>
          <Snippet
            code={
              shadcn
                ? shadcnSnippet(seed, background, hue, expression, shape)
                : snippet(fw, seed, background, hue, expression, shape)
            }
          />
          <p className="text-muted text-xs leading-relaxed">
            Every prop is optional except the name. Drop{" "}
            <code className="font-mono">animate</code> and the blobatar renders as a
            single <code className="font-mono">&lt;img&gt;</code>.
          </p>

          {/*
            A plain anchor to a plain second document, which is the whole reason
            it costs nothing: no router, no prefetch, no editor code in this
            bundle. The panel above is four axes and this page is not the place
            for twenty, so the link is where the four run out.
          */}
          <a
            href="/editor"
            className="text-muted hover:text-ink group inline-flex w-fit items-center gap-1.5 text-xs transition-colors"
          >
            Tune every trait in the editor
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * One silhouette, rendered as itself.
 *
 * Static `<img>`s, deliberately — same trade the expression row makes: seven
 * live SVG trees inside a panel would be seven things competing with the one
 * that is supposed to be moving. The options spread in carry whatever else is
 * currently tuned, so the row restyles as you change hue or expression rather than
 * showing six blobatars from a different configuration.
 */
function ShapeTile({
  label,
  seed,
  opts,
  selected,
  onClick,
}: {
  label: string;
  seed: string;
  opts: BlobatarOptions;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl py-2 transition-colors duration-150",
        selected ? "bg-line/70" : "hover:bg-line/30",
      )}
    >
      <Blobatar name={seed || " "} {...opts} alt="" className="size-9" />
      <span
        className={cn(
          "font-mono text-[0.65rem] lowercase transition-colors",
          selected ? "text-ink" : "text-muted",
        )}
      >
        {label}
      </span>
    </button>
  );
}

/**
 * One pose, shown rather than named — the same argument `ShapeTile` makes. It
 * became a component when the roster outgrew a single row: the tile is rendered
 * from two places now, and two copies of it would be two places for the selected
 * wash to drift apart.
 *
 * Static `<img>`s, deliberately. A pose renders without `animate` — that is the
 * library's own claim — and ten live SVG trees inside a panel would be ten
 * things competing with the one that is supposed to be moving.
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted text-[0.7rem] tracking-wide lowercase">{label}</span>
      {children}
    </div>
  );
}

/**
 * Shaped like the options trigger on purpose — same padding, radius and hover
 * wash. They are the only three icon-only controls on the page, and two of them
 * sitting in the same column with different hit areas reads as an accident.
 */
/**
 * A page in the hero's row. Same hit target and same colours as `SocialLink`,
 * with a word in place of a mark, so the two kinds of link read as one row
 * rather than as text that happens to sit beside some icons.
 */
function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={cn(
        "text-muted hover:text-ink hover:bg-line/50 rounded-lg px-2 py-1.5 text-sm",
        "transition-colors duration-150",
      )}
    >
      {children}
    </a>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        // `-mr-1.5` on the row's last child cancels the icon padding, so the
        // marks themselves sit flush with the section edge instead of floating
        // 6px inside it. Harmless on the first one.
        "text-muted hover:text-ink hover:bg-line/50 rounded-lg p-1.5 last:-mr-1.5",
        "transition-colors duration-150",
      )}
    >
      {children}
    </a>
  );
}

/**
 * Both marks are solid `fill`, not strokes like the rest of the page's icons —
 * these are wordmarks with fixed geometry, and redrawing them as 1.7px outlines
 * would make them not-quite-GitHub and not-quite-X.
 */
function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-[1.15rem]">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.5 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-[1.05rem]">
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.22-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.01 4.13H5.05l12.03 15.64Z" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      className="size-[1.15rem]"
    >
      <path d="M4 8h8M17 8h3M4 16h3M12 16h8" />
      <circle cx="14.5" cy="8" r="2.2" />
      <circle cx="9.5" cy="16" r="2.2" />
    </svg>
  );
}
