import { useMemo, useState } from "react";
import { Blobatar } from "blobatar/react";
import { traits as reader, type TraitOverrides } from "blobatar";
import { Control } from "@/components/editor/control";
import { ShapePicker, TonePicker } from "@/components/editor/pickers";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Snippet } from "@/components/ui/snippet";
import { Install } from "@/components/ui/install";
import {
  AXES,
  GROUPS,
  applies,
  candidates,
  round3,
  shapePin,
  type Axis,
  type Group,
  type Shape,
} from "@/editor/axes";
import { blobLayout, resolved } from "@/editor/resolved";
import { snippet, type Api, type Motion } from "@/editor/snippet";
import { NAMES } from "@/names";
import { cn } from "@/lib/utils";

/**
 * The editor.
 *
 * Its own document, not a route on the landing page — see `build.ts`. The
 * bundle here carries a slider, twenty controls and a live layout readback,
 * none of which the landing page has any use for, and that page's first paint
 * is already the thing its whole build is tuned around.
 *
 * **The snippet is the deliverable.** The tuned blobatar is the demonstration;
 * the code underneath is what you leave with, and every trade between the two
 * goes to the code. That is why the readouts are raw trait positions rather
 * than friendly units, why the name is emitted literally, and why pinning —
 * the thing that decides what appears in the snippet — is the only piece of
 * interaction state on the page.
 *
 * One state shape carries all of it: `pinned` is simultaneously the UI's notion
 * of which axes you have taken control of, the `traits` map handed to the
 * library, and the object literal in the generated code. They cannot drift,
 * because they are the same object.
 */
export function Editor() {
  const [name, setName] = useState("alain00");
  const [pinned, setPinned] = useState<TraitOverrides>({});
  const [api, setApi] = useState<Api>("react");
  const [motion, setMotion] = useState<Motion>("hover");

  /**
   * Every trait's current position, pinned or hashed — the same reader the
   * library builds internally, over the same name and the same overrides.
   *
   * This is what lets an unpinned slider show where it actually sits instead of
   * sitting at zero waiting to be told. Without it the panel would open as an
   * empty form in front of a blobatar it claims to describe.
   */
  const t = useMemo(() => reader(name, true, pinned), [name, pinned]);

  // The resolved geometry, for the two things only it can answer: which
  // silhouette the name produced when `shape` is unpinned, and where the eye
  // cluster ended up when `fit` scaled it.
  const layout = useMemo(() => blobLayout(name || " ", pinned), [name, pinned]);
  const ghosts = useMemo(() => resolved(layout, t), [layout, t]);

  /**
   * The silhouettes the panel has to cover, which is not always the one on
   * screen: narrowing the silhouette to several means the same config renders a
   * cloud for one name and a sun for the next, and a decoration control that
   * appears only for the name you happen to be previewing is a control you
   * would never find. See `candidates`.
   */
  const shapes = useMemo(
    () => candidates(pinned.shape, layout.shape as Shape),
    [pinned.shape, layout.shape],
  );

  const pin = (key: string, v: number) =>
    setPinned(p => ({ ...p, [key]: round3(v) }));

  /** The silhouette row, which writes a *set* where every other control writes a number. */
  const pinShapes = (ats: number[]) =>
    setPinned(({ shape: _gone, ...rest }) => {
      const pin = shapePin(ats);
      return pin === undefined ? rest : { ...rest, shape: pin };
    });

  /** The pickers' `auto` chip, which is always a removal rather than a toggle. */
  const unpin = (key: string) =>
    setPinned(({ [key]: _gone, ...rest }) => rest);

  const toggle = (key: string) =>
    setPinned(p => {
      if (key in p) {
        const { [key]: _gone, ...rest } = p;
        return rest;
      }
      // Snapped on the way in, not on the way out. The hashed value has full
      // float precision and the snippet emits three decimals — pinning the
      // rounded number is what keeps the preview and the generated code driven
      // by the identical value. See `round3`.
      return { ...p, [key]: round3(t(key)) };
    });

  /**
   * Re-roll everything unpinned, by changing the name.
   *
   * The alternative — rolling each unpinned trait independently — was the other
   * half of the spec's open question, and this is the one that produces
   * blobatars that look designed: a name moves every unpinned axis *together*,
   * through the same hash the library ships, so what comes back is a blobatar
   * somebody could actually have. Independent rolls produce the average of the
   * space, which is a lumpy pebble with mismatched eyes, over and over.
   */
  const shuffle = () =>
    setName(prev => {
      let next = prev;
      while (next === prev) {
        const base = NAMES[Math.floor(Math.random() * NAMES.length)]!;
        next = Math.random() < 0.5 ? base : `${base}${Math.floor(Math.random() * 90) + 10}`;
      }
      return next;
    });

  const count = Object.keys(pinned).length;
  const code = snippet({ api, name, pinned, motion });

  return (
    /*
      A screen tall on a wide layout, and the page itself does not scroll: the
      preview, the snippet and the panel are one working surface, and a page
      that scrolls as a whole moves the blobatar you are tuning off the top of
      it. The only scroller is the panel — twenty-odd controls will not fit on a
      laptop and are not meant to, while everything in the left column is sized
      to what is left over. Narrow keeps the ordinary document scroll, where
      nothing can be beside anything and a screen-tall shell would just be a
      window inside a window.
    */
    <main className="mx-auto flex max-w-6xl flex-col px-6 pb-24 lg:h-svh lg:overflow-hidden lg:pb-6">
      <header className="flex items-center justify-between gap-4 py-6">
        <a
          href="/"
          className="text-muted hover:text-ink group flex items-baseline gap-2 text-sm transition-colors"
        >
          <span className="group-hover:-translate-x-0.5 inline-block transition-transform">←</span>
          blobatar
        </a>
        <span className="text-muted font-mono text-xs lowercase">editor</span>
      </header>

      {/*
        Three blocks, placed rather than nested, because their order is not the
        same on both layouts.

        Wide: the blobatar and the code it produces stack in one column with the
        panel beside them, so nothing you drag moves the thing you are looking
        at, and the snippet is in view the whole time you are tuning.

        Narrow: nothing can be beside anything, so the order becomes preview,
        panel, snippet — controls before code. The alternative puts a twelve-line
        snippet between the blobatar and the sliders, which on a phone means
        scrolling past the output to reach the input and back again to see what
        it did. The snippet lands last because it is where you finish.
      */}
      <div
        className={cn(
          "grid gap-10 lg:min-h-0 lg:flex-1 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-x-14 lg:gap-y-8",
          // `auto` then `1fr`, and it is load-bearing: the panel spans both rows
          // and is a screen tall, so with default row sizing that height gets
          // shared between them and the snippet drifts half a screen below the
          // blobatar it describes. Sizing the first row to the preview puts them
          // back together and gives the slack to the row that has nothing under
          // it.
          "lg:grid-rows-[auto_1fr]",
        )}
      >
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Preview
            name={name}
            setName={setName}
            pinned={pinned}
            motion={motion}
            setMotion={setMotion}
            onShuffle={shuffle}
          />
        </div>

        {/*
          `order-3` rather than a different DOM order, so the wide layout — where
          this reads directly under the blobatar it describes — keeps focus order
          matching what is on screen. The cost lands on narrow, where the snippet
          is announced before the panel it is visually below. Both are one swipe
          apart either way.
        */}
        {/*
          `min-w-0`, and it is not decoration: a grid item's automatic minimum
          size is its *content's* width, and the snippet's longest line is a
          hundred characters of import. Without it the column refuses to be
          narrower than that line, the page grows wider than the phone it is on,
          and everything above scrolls sideways — with the `overflow-x-auto` on
          the code block never getting a chance to do its job.
        */}
        {/*
          `h-full` with `overflow-hidden` on a wide screen: the column takes the
          height the row gives it rather than the height its content wants, which
          is what puts the shrinking on the code box below instead of pushing the
          install line off the bottom of a page that has nowhere to scroll to.
        */}
        <div
          className={cn(
            "order-3 flex min-w-0 flex-col gap-3",
            "lg:col-start-1 lg:row-start-2 lg:h-full lg:min-h-0 lg:overflow-hidden",
          )}
        >
          <div className="text-muted flex items-baseline justify-between gap-4 text-xs lowercase">
            <span>your config</span>
            <Select value={api} onValueChange={v => v && setApi(v as Api)}>
              <SelectTrigger aria-label="API" className="w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="react">react</SelectItem>
                <SelectItem value="vue">vue</SelectItem>
                <SelectItem value="svelte">svelte</SelectItem>
                <SelectItem value="solid">solid</SelectItem>
                <SelectItem value="preact">preact</SelectItem>
                <SelectItem value="string">string</SelectItem>
                <SelectItem value="http">http</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/*
            The one element in this column that gives. `min-h-0` and nothing
            else: every other item here refuses to shrink below its text, so the
            code box is what absorbs a short viewport — scrolling its own
            overflow instead of pushing the install line off a page that has
            nowhere to scroll to. Deliberately not `flex-1`: it takes the height
            its code wants and no more, or a seven-line snippet becomes a
            half-screen of empty box on a tall display.
          */}
          <Snippet code={code} className="lg:min-h-0" />

          <p className="text-muted text-xs leading-relaxed">
            {count === 0
              ? "Nothing is pinned, so this blobatar is entirely the name — which is the default, and usually the right one. Pin an axis to fix it for everybody."
              : `${count} pinned ${count === 1 ? "axis is" : "axes are"} fixed for every name; everything else still comes from the one you pass.${
                  // The one pinned axis that is not fixed. Worth its own clause
                  // rather than a footnote: a list in the snippet reads like a
                  // typo until you know it is the third thing an override can
                  // be, and this is where somebody looks to find out.
                  Array.isArray(pinned.shape)
                    ? ` The silhouette is the exception — it is narrowed to ${pinned.shape.length}, and the name still picks between them.`
                    : ""
                }`}
          </p>

          <Install command="bun add blobatar" className="mt-2 self-start" />
        </div>

        {/*
          The page's only scroller on a wide screen, so the preview and the
          snippet stay put while you work down the panel — the whole argument
          for the two columns is that the thing you are tuning never moves.
        */}
        <div
          className={cn(
            "border-line bg-raised/60 order-2 flex min-w-0 flex-col gap-6 rounded-2xl border p-5",
            "lg:col-start-2 lg:row-span-2 lg:row-start-1",
            "lg:self-stretch lg:min-h-0 lg:overflow-y-auto",
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted text-xs lowercase">
              {count === 0 ? "nothing pinned" : `${count} pinned`}
            </span>
            <button
              type="button"
              onClick={() => setPinned({})}
              disabled={count === 0}
              className={cn(
                "text-muted hover:text-ink hover:bg-line/50 rounded-lg px-2.5 py-1 text-xs lowercase",
                "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-30",
              )}
            >
              unpin all
            </button>
          </div>

          {GROUPS.map(group => (
            <GroupBlock
              key={group}
              group={group}
              shapes={shapes}
              name={name}
              pinned={pinned}
              hue={t("hue") * 360}
              // A narrowed key has no single pinned position, so the slider
              // reads the one the name resolved to — which is the same answer
              // an unpinned axis gets, and the right one: it is where the
              // blobatar on screen actually sits.
              value={key => (typeof pinned[key] === "number" ? (pinned[key] as number) : t(key))}
              ghost={key => ghosts[key]}
              onChange={pin}
              onPin={toggle}
              onUnpin={unpin}
              onPickShapes={pinShapes}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function Preview({
  name,
  setName,
  pinned,
  motion,
  setMotion,
  onShuffle,
}: {
  name: string;
  setName: (v: string) => void;
  pinned: TraitOverrides;
  motion: Motion;
  setMotion: (m: Motion) => void;
  onShuffle: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/*
        The hero's dashed blank, at panel scale. Same argument: a boxed input
        with a placeholder says "data entry", and this is the one field on the
        page that stands for a person. The invisible copy underneath is what
        carries the width, so the rule grows with what you type.
      */}
      <div className="flex w-full items-baseline justify-center gap-3 text-lg">
        <label htmlFor="editor-name" className="text-muted cursor-text lowercase">
          name
        </label>
        <span className="border-line hover:border-muted focus-within:border-ink inline-grid border-b border-dashed pb-1 transition-colors duration-200">
          <span
            aria-hidden="true"
            className="invisible col-start-1 row-start-1 px-1 tracking-tight whitespace-pre"
          >
            {name || "someone"}
          </span>
          <input
            id="editor-name"
            value={name}
            onChange={e => setName(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="someone"
            size={1}
            className="col-start-1 row-start-1 w-full min-w-0 bg-transparent px-1 text-center tracking-tight outline-none placeholder:text-muted/40"
          />
        </span>
        <button
          type="button"
          onClick={onShuffle}
          aria-label="Shuffle — re-rolls every unpinned axis"
          title="Shuffle — re-rolls every unpinned axis"
          className="text-muted hover:text-ink hover:bg-line/50 -mb-1 self-center rounded-lg p-1.5 transition-colors duration-150"
        >
          <ShuffleIcon />
        </button>
      </div>

      {/*
        A `vh` term alongside the `vmin` one, because the wide layout is a
        screen tall and does not scroll: on a short laptop the blobatar is what
        gives first, so that the snippet and the install line under it stay on
        screen rather than being clipped by a preview sized off the width.

        Two elements rather than one with a variable `animate`, and the union in
        `BlobatarProps` is why: a static blobatar is an `<img>` and an animated
        one is inline SVG, so `alt` and `onLoad` stop meaning anything the
        moment motion is on. The library types that as a discriminated union
        precisely so this is a compile error rather than a dead prop.
      */}
      {motion ? (
        <Blobatar
          name={name || " "}
          traits={pinned}
          animate={motion}
          title={`Blobatar for ${name}`}
          className="editor-preview size-[min(15rem,34vmin,28vh)]"
        />
      ) : (
        <Blobatar
          name={name || " "}
          traits={pinned}
          alt={`Blobatar for ${name}`}
          className="size-[min(15rem,34vmin,28vh)]"
        />
      )}

      <div className="flex items-center gap-3">
        <span className="text-muted text-xs lowercase">motion</span>
        <Segmented
          type="single"
          value={motion === false ? "none" : motion}
          onValueChange={(v: string) =>
            v && setMotion(v === "none" ? false : (v as Motion))
          }
          aria-label="Motion"
        >
          <SegmentedItem value="none">none</SegmentedItem>
          <SegmentedItem value="hover">hover</SegmentedItem>
          <SegmentedItem value="always">always</SegmentedItem>
        </Segmented>
      </div>
    </div>
  );
}

interface GroupProps {
  group: Group;
  /** Every silhouette this config can produce, not just the one on screen. */
  shapes: Shape[];
  name: string;
  pinned: TraitOverrides;
  hue: number;
  value: (key: string) => number;
  ghost: (key: string) => number | undefined;
  onChange: (key: string, v: number) => void;
  onPin: (key: string) => void;
  onUnpin: (key: string) => void;
  onPickShapes: (ats: number[]) => void;
}

function GroupBlock({
  group,
  shapes,
  name,
  pinned,
  hue,
  value,
  ghost,
  onChange,
  onPin,
  onUnpin,
  onPickShapes,
}: GroupProps) {
  const all = AXES.filter(a => a.group === group);
  const live = all.filter(a => applies(a, shapes));
  const missing = all.filter(a => !applies(a, shapes));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-muted border-line border-b pb-2 text-[0.7rem] tracking-wide lowercase">
        {group}
      </h2>

      {live.map(axis =>
        axis.kind === "shape" ? (
          <div key={axis.key} className="flex flex-col gap-2">
            <ShapePicker
              name={name}
              traits={pinned}
              value={pinned.shape}
              onPick={onPickShapes}
            />
            {/*
              Said only when it applies, because until you pick a second tile
              there is nothing here a person does not already believe. Once
              there is, it is the whole feature in one line: the config narrows
              the silhouette, and the name still chooses inside it.
            */}
            {shapes.length > 1 && (
              <p className="text-muted/60 text-[0.7rem] leading-relaxed lowercase">
                {shapes.length} selected — each name gets one of them, so the
                controls below cover all {shapes.length}
              </p>
            )}
          </div>
        ) : axis.kind === "tone" ? (
          <TonePicker
            key={axis.key}
            hue={hue}
            // Narrowing is a silhouette feature today: the chips are still a
            // choice, so anything but a number here is not a tone this row can
            // show as selected. The cast the alternative needs is the tell.
            value={typeof pinned.tone === "number" ? pinned.tone : undefined}
            onPick={at => (at === null ? onUnpin("tone") : onChange("tone", at))}
          />
        ) : (
          <Control
            key={axis.key}
            axis={axis}
            value={value(axis.key)}
            pinned={axis.key in pinned}
            ghost={ghost(axis.key)}
            onChange={v => onChange(axis.key, v)}
            onPin={() => onPin(axis.key)}
          />
        ),
      )}

      {/*
        Why the panel is shorter than it was a moment ago.

        A control that does nothing is worse than a control that is not there,
        and a control that vanishes with no explanation is worse than both. One
        line per family of missing axes covers the tilt slider and the three
        decoration sets with the same sentence.
      */}
      {conditions(missing).map(([when, axes]) => (
        <p key={when} className="text-muted/60 text-[0.7rem] leading-relaxed lowercase">
          {axes.map(a => a.label).join(", ")} — {when} only
          {/*
            A pin outlives the silhouette it was made on: switching from sun to
            nub leaves `sun.n` pinned, and it stays in the snippet because
            throwing away something you set is worse than carrying something
            inert — a sparse override on a key the layout never reads changes
            nothing. But it is in your code, so it is said out loud here rather
            than discovered in a diff.
          */}
          {axes.some(a => a.key in pinned) && " · still pinned, still in the snippet"}
        </p>
      ))}
    </section>
  );
}

/** Missing axes, grouped by the silhouettes they need. */
function conditions(missing: Axis[]) {
  const by = new Map<string, Axis[]>();
  for (const a of missing) {
    const when = a.when!.join("/");
    by.set(when, [...(by.get(when) ?? []), a]);
  }
  return [...by];
}

/**
 * Two arrows crossing, the standard shuffle mark. Same 1.7px outline as the
 * rest of the page's icons — see the hero's `SlidersIcon`.
 */
function ShuffleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-[1.05rem]"
    >
      <path d="M3 7h3.5l3 5m0 0 3 5H16M3 17h3.5l3-5" />
      <path d="M16 4.5 19.5 7 16 9.5M16 14.5 19.5 17 16 19.5" />
      <path d="M13 7h3.5M13 17h3.5" />
    </svg>
  );
}
