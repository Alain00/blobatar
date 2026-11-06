/**
 * The option matrix every adapter is compared over.
 *
 * Extracted from `adapters.test.ts` when the React Native adapter arrived,
 * because that one cannot join the roster in that file. It renders no `<img>`,
 * so the static assertion there does not hold for it, and it has no `animate`
 * at all, so half the table's cases do not exist on its platform. It gets its
 * own file and a different instrument, the way `@blobatar/svelte` needed the
 * ship gate to grow a second way of measuring (ADR-0010).
 *
 * What it must not get is a different *matrix*. Two adapters compared over two
 * lists agree about whatever they happen to share, and the case nobody checks
 * is the one that breaks, so the list lives here and both files read it, for
 * the same reason `test/golden/corpus.ts` is shared by the fixture's writer and
 * its checker.
 */
import { christmas, halloween } from "blobatar/seasonal";

export const CASES: [string, Record<string, unknown>][] = [
  // The bare call is the one that caught a real bug: with no `background`
  // prop declared default, Vue passed an explicit `false` here.
  ["nothing but a name", { name: "alain" }],
  ["a size", { name: "alain", size: 48 }],
  ["a backdrop", { name: "alain", background: "circle" }],
  ["a suppressed backdrop", { name: "alain", background: false }],
  ["a backdrop color", { name: "alain", background: "circle", backgroundColor: "#ff8800" }],
  ["a pinned hue", { name: "alain", hue: 210 }],
  ["a pinned tone", { name: "alain", tone: 0.2 }],
  ["pinned traits", { name: "alain", traits: { "body.r": 0.9 } }],
  ["a title", { name: "alain", title: "Alain" }],
  ["normalization off", { name: "  ALAIN  ", normalize: false }],
  ["contrast off", { name: "alain", contrast: false }],
  // Unlike an expression, a season is in the table: its marks and fit are what
  // an adapter that draws its own figure would most likely drop.
  ["a season", { name: "alain", season: halloween }],
  ["a season with a fit", { name: "alain", season: christmas }],
];
