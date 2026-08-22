import { useMemo, useState } from "react";
import {
  blobatar,
  traits,
  type Animate,
  type BlobatarOptions,
  type Travel,
} from "blobatar";
import { layout } from "blobatar/blob";
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
import { Blobatar } from "@blobatar/react";
import { CANDIDATES } from "./candidates";

/**
 * The tuning harness.
 *
 * The point is the grid, not the single blobatar. Numeric ranges can only be
 * judged in aggregate — you are looking for clusters, dead zones and outliers,
 * which are invisible when you inspect one seed at a time. The shape filter
 * exists because the rarer silhouettes would otherwise appear a handful of
 * times per page, which is too few to tune against.
 */

const COLS = 20;
const ROWS = 20;

/**
 * Blobatar 2's silhouettes, including `all` for an unfiltered grid.
 */
const SHAPES = [
  "all", "round", "organic", "boxy", "capsule", "nub",
  "cloud", "droplet", "hexagon", "sun", "triangle",
] as const;

/**
 * The package major's silhouette for a seed, without paying for a palette.
 */
const silhouetteOf = (seed: string) => layout(traits(seed)).shape;

/**
 * The candidate ballot, as a grid mode.
 *
 * It is a *third* rendering mode rather than a fourth entry in `PAIRS` because
 * the two modes answer opposite questions. A pair asks whether two poses are
 * confusable, so it renders through the string API deliberately — idle motion
 * running underneath is noise on exactly that comparison. The ballot asks which
 * of three *loops* reads best, so it does the reverse: it forces the animated
 * adapter on regardless of the `animate` control, because a still frame of these
 * three would only collect votes on eye position.
 */
const TRIO = "thinking: A|B|C";

/**
 * The `a|b` entries are not expressions — they are the comparisons the roster
 * hangs on, rendered as modes. See `.cell.pair` in index.css.
 *
 * There are two now because the second roster added a second at-risk pair.
 * `sad|mad` was the original: two poses that have to stay distinct at 44px with
 * no brows to separate them. `surprised|scared` is its counterpart at the other
 * end of `esy` — the only two poses that leave the capsule portrait, so they are
 * the ones that can converge.
 */
const EXPRESSIONS: Record<string, Expression | null> = {
  idle,
  happy,
  sad,
  mad,
  surprised,
  wink,
  sleepy,
  smug,
  unsure,
  scared,
  love,
  shy,
  sick,
  thinking,
  "sad|mad": null,
  "surprised|scared": null,
  "shy|sick": null,
  "sleepy|thinking": null,
  [TRIO]: null,
};
const PAIRS: Record<string, Expression[]> = {
  "sad|mad": [sad, mad],
  "surprised|scared": [surprised, scared],
  "shy|sick": [shy, sick],
  // The pair that has to stay apart at 44px: both are lidded and level, and
  // only one of them is staggered.
  "sleepy|thinking": [sleepy, thinking],
};

/**
 * Travel directions, plus `""` for off. `seeded` lets each name pick its own
 * direction, which is the setting a crowd is judged in.
 */
const TRAVELS = ["", "ltr", "rtl", "ttb", "btt", "seeded"] as const;

type Bg = "default" | "squircle" | "circle" | "square" | "none";

export function App() {
  const [prefix, setPrefix] = useState("user-");
  const [page, setPage] = useState(0);
  const [bg, setBg] = useState<Bg>("default");
  const [shape, setShape] = useState("all");
  const [hue, setHue] = useState<number | "">("");
  const [focus, setFocus] = useState<string | null>(null);
  const [animate, setAnimate] = useState<Animate | "">("");
  const [travel, setTravel] = useState<Travel | "">("");
  const [slow, setSlow] = useState(false);
  const [expr, setExpr] = useState<keyof typeof EXPRESSIONS>("idle");

  const opts: BlobatarOptions = useMemo(
    () => ({
      background: bg === "default" ? undefined : bg === "none" ? false : bg,
      hue: hue === "" ? undefined : hue,
      expression: EXPRESSIONS[expr] ?? undefined,
    }),
    [bg, hue, expr],
  );

  const pair = PAIRS[expr];
  const trio = expr === TRIO ? CANDIDATES : null;

  // Paired cells are twice as wide, so half as many fit a row. Keeping the
  // count tied to the columns means a page is still a full screen either way.
  // The ballot is wider still, and deliberately much coarser: five seeds is
  // plenty when the question is about a loop rather than about a numeric range,
  // and the cells have to be large enough to actually watch.
  const cols = trio ? 4 : pair ? COLS / 2 : COLS;
  const count = trio ? cols * 2 : cols * ROWS;

  // Filtering by shape means scanning forward past the seeds that do not match,
  // so a rare silhouette still fills a whole page.
  const seeds = useMemo(() => {
    const out: string[] = [];
    const wanted = shape !== "all" ? shape : null;
    for (
      let i = page * count;
      out.length < count && i < page * count + count * 200;
      i++
    ) {
      const seed = `${prefix}${i}`;
      if (!wanted || silhouetteOf(seed) === wanted) out.push(seed);
    }
    return out;
  }, [prefix, page, shape, count]);

  const stats = useMemo(() => {
    const sizes = seeds.map((s) => blobatar(s, opts).length);
    return {
      min: Math.min(...sizes),
      max: Math.max(...sizes),
      avg: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
    };
  }, [seeds, opts]);

  return (
    // `mo-slow` sits here rather than on the grid so it also reaches the focus
    // sheet, which renders outside it — reviewing timing at a legible size is
    // most of what slow motion is for.
    <main className={slow ? "mo-slow" : undefined}>
      <header>
        <h1>blobatar</h1>
        <div className="controls">
          <label>
            shape
            <select
              value={shape}
              onChange={(e) => (setShape(e.target.value), setPage(0))}
            >
              {SHAPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            seed prefix
            <input
              value={prefix}
              onChange={(e) => (setPrefix(e.target.value), setPage(0))}
            />
          </label>
          <label>
            background
            <select value={bg} onChange={(e) => setBg(e.target.value as Bg)}>
              {(
                ["default", "squircle", "circle", "square", "none"] as Bg[]
              ).map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={hue !== ""}
              onChange={(e) => setHue(e.target.checked ? 200 : "")}
            />
            lock hue
          </label>
          <label>
            <input
              type="range"
              min={0}
              max={360}
              value={hue === "" ? 0 : hue}
              onChange={(e) => setHue(Number(e.target.value))}
              disabled={hue === ""}
            />
          </label>
          <label>
            animate
            <select
              value={animate}
              onChange={(e) => setAnimate(e.target.value as Animate | "")}
            >
              <option value="">off</option>
              <option value="hover">hover</option>
              <option value="always">always</option>
            </select>
          </label>
          <label>
            travel
            <select
              value={travel}
              // Travel moves the whole figure, which only exists in the animated
              // branch — off (and greyed out) whenever animation is off.
              disabled={!animate}
              onChange={(e) => setTravel(e.target.value as Travel | "")}
            >
              {TRAVELS.map((t) => (
                <option key={t} value={t}>
                  {t === "" ? "off" : t}
                </option>
              ))}
            </select>
          </label>
          <label>
            expression
            <select
              value={expr}
              onChange={(e) =>
                setExpr(e.target.value as keyof typeof EXPRESSIONS)
              }
            >
              {Object.keys(EXPRESSIONS).map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={slow}
              onChange={(e) => setSlow(e.target.checked)}
              // The ballot animates whatever the `animate` control says, so the
              // one control that matters most for judging it must not be greyed
              // out along with that one. Timing is most of what is being voted
              // on, and 5× is where a 91ms saccade becomes something an eye can
              // actually inspect.
              disabled={!animate && !trio}
            />
            5× slower
          </label>
          <div className="spacer" />
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ←
          </button>
          <code>page {page + 1}</code>
          <button onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
        <p className="stats">
          {seeds.length} blobatars · svg {stats.min}–{stats.max} bytes (avg{" "}
          {stats.avg}){hue !== "" && ` · hue ${hue}°`}
        </p>
      </header>

      <div
        className="grid"
        // Turns off the demo's own cell hover-scale, which would otherwise
        // compound with the library's hover reaction (1.12 × 1.04) on a
        // different clock, and make it impossible to judge.
        data-animate={animate || undefined}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {seeds.map((seed) =>
          trio ? (
            // Always `animate="always"`, whatever the `animate` control says.
            // Two of these three exist only as motion — a still `look away` is
            // just eyes off to one side, and a still `orbit` is eyes riding
            // high — so a frozen ballot would collect votes on the one thing
            // none of the candidates is about.
            <button
              key={seed}
              className="cell trio"
              title={seed}
              onClick={() => setFocus(seed)}
            >
              {trio.map(([label, e]) => (
                <span key={label}>
                  <Blobatar
                    name={seed}
                    animate="always"
                    {...opts}
                    expression={e}
                  />
                  <em>{label}</em>
                </span>
              ))}
            </button>
          ) : pair ? (
            // Both halves are the same seed, so every difference on screen is the
            // expression and nothing else. Rendered through the string API even
            // when animating: this mode is for judging the two *poses* against
            // each other, and idle motion running underneath them is noise on
            // exactly the comparison being made.
            <button
              key={seed}
              className="cell pair"
              title={seed}
              onClick={() => setFocus(seed)}
            >
              {pair.map((e, i) => (
                <span
                  key={i}
                  dangerouslySetInnerHTML={{
                    __html: blobatar(seed, { ...opts, expression: e }),
                  }}
                />
              ))}
            </button>
          ) : animate ? (
            // Goes through the real adapter rather than the string API, because
            // the inline-SVG branch is the thing worth exercising here.
            <button
              key={seed}
              className="cell"
              title={seed}
              onClick={() => setFocus(seed)}
            >
              <Blobatar
                name={seed}
                animate={animate}
                travel={travel || undefined}
                {...opts}
              />
            </button>
          ) : (
            <button
              key={seed}
              className="cell"
              title={seed}
              onClick={() => setFocus(seed)}
              dangerouslySetInnerHTML={{ __html: blobatar(seed, opts) }}
            />
          ),
        )}
      </div>

      {focus && (
        <div className="sheet" onClick={() => setFocus(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            {/*
              Animated at "always" whenever animation is on at all. A modal has
              no grid to sweep, so "hover" would mean the blobatar you opened to
              look at sits perfectly still — and the whole point of opening it
              is to watch the motion at a size where it is legible.
            */}
            {trio ? (
              <div className="big trio">
                {trio.map(([label, e]) => (
                  <span key={label}>
                    <Blobatar
                      name={focus}
                      animate="always"
                      {...opts}
                      expression={e}
                    />
                    <em>{label}</em>
                  </span>
                ))}
              </div>
            ) : pair ? (
              <div className="big pair">
                {pair.map((e, i) => (
                  <span
                    key={i}
                    dangerouslySetInnerHTML={{
                      __html: blobatar(focus, { ...opts, expression: e }),
                    }}
                  />
                ))}
              </div>
            ) : animate ? (
              <div className="big">
                <Blobatar
                  name={focus}
                  animate="always"
                  travel={travel || undefined}
                  {...opts}
                />
              </div>
            ) : (
              <div
                className="big"
                dangerouslySetInnerHTML={{ __html: blobatar(focus, opts) }}
              />
            )}
            <div className="meta">
              <strong>{focus}</strong>
              <span>
                {blobatar(focus, opts).length} bytes ·{" "}
                {silhouetteOf(focus)}
              </span>
              <div className="swatches">
                {[
                  ...new Set(blobatar(focus, opts).match(/#[0-9a-f]{6}/g) ?? []),
                ].map((c) => (
                  <span key={c} style={{ background: c }} title={c} />
                ))}
              </div>
              <textarea readOnly value={blobatar(focus, opts)} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
