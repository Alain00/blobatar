/**
 * The adapters film: the line it edits, the clock, and the number on screen.
 *
 * The tweet makes one claim — *the Vue adapter is the React adapter* — and the
 * film has one moving part to match. A single import specifier is edited from
 * `@blobatar/react` to `@blobatar/vue`, and the blobatar above it does not change,
 * because it cannot: the two adapters resolve to the same markup.
 *
 * What makes this a film rather than an assertion is that the creature is not a
 * picture of the claim, it *is* the claim. Remotion is React, so the cheap cut
 * renders `@blobatar/react` throughout and merely writes the other name in the
 * code pane — parity asserted by a film demonstrating one adapter twice. This
 * one mounts a real Vue app (see `VueMount.tsx`) and hands the frame to it the
 * instant the specifier commits. Both are on screen the whole time, stacked and
 * pinned; the edit only decides which is opaque. The swap is invisible because
 * the output is identical, which is the entire point and the only reason a shot
 * of nothing happening is worth eight seconds.
 *
 * The third element is a byte count that never moves. It is measured, not
 * written: `scripts/check-adapters.ts` server-renders both adapters and refuses
 * the build if `BYTES` is not what they actually produce.
 */

import { FPS } from "./timeline";

export { FPS, HEIGHT, WIDTH } from "./timeline";

/** The name the film renders, and the size it renders at. Both are on screen. */
export const NAME = "alain00";
export const SIZE = 400;

/**
 * The blobatar's markup, in bytes, as either adapter renders it.
 *
 * Normalized first, and the normalization is the honest part. Raw SSR output is
 * *not* byte-identical: Vue emits `<!---->` anchors where a child is null and a
 * trailing `;` on the serialized style attribute, so the two differ by 15 bytes
 * before anything is compared. Those are renderer artefacts, not blobatar — the
 * anchors are deliberately wanted, since they hold the root `<g>` at a fixed
 * index whether or not a `<title>` is present — and `test/adapters.test.ts`
 * normalizes exactly those three and nothing else.
 *
 * So the number on screen is the size of the blobatar the two agree on, and the
 * caption says "of svg" rather than "of output" for that reason.
 *
 * 1390 as of the travel/depth change (docs/3d-directional-motion-plan.md): an
 * animated blobatar now also carries the ground shadow, the sheen, and the
 * mo-travel wrapper. Static renders are untouched — this number pins the
 * animated one precisely because that is the branch new markup lands in.
 */
export const BYTES = 1390;

/** The two specifiers, and the only characters in the film that change. */
export const FROM = "react";
export const TO = "vue";

export const line = (which: string) =>
  `import { Blobatar } from "blobatar/${which}"`;

/** Where the edit lands in the line, so the changed word can be lit. */
export const AT = line("").indexOf('"') + 1 + "blobatar/".length;

/** The usage line — identical in JSX and in a Vue template, which is the joke. */
export const USE = `<Blobatar name="${NAME}" animate="always" />`;

/** Frames per character. Deleting is faster than typing, as it is in a hand. */
const TYPE = 2;
const DEL = 1;

// Beat boundaries.
export const B_IN = 10;
export const B_EDIT = 76;
export const EDIT_COST = FROM.length * DEL + TO.length * TYPE;
export const B_COMMIT = B_EDIT + EDIT_COST;
export const B_CARD = B_COMMIT + 104;
export const END = B_CARD + 96;

/** The specifier on a frame, and whether it has committed. */
export function specifierAt(frame: number): { text: string; committed: boolean } {
  if (frame < B_EDIT) return { text: FROM, committed: false };
  if (frame >= B_COMMIT) return { text: TO, committed: true };

  const del = FROM.length * DEL;
  if (frame < B_EDIT + del) {
    const gone = Math.floor((frame - B_EDIT) / DEL);
    return { text: FROM.slice(0, FROM.length - gone), committed: false };
  }
  const typed = Math.floor((frame - B_EDIT - del) / TYPE);
  return { text: TO.slice(0, typed), committed: false };
}

/**
 * Which adapter owns the frame.
 *
 * Flipped on the commit, not on the first deleted character: while the line
 * reads `blobatar/rea` it names nothing, and a frame is not allowed to show a
 * blobatar produced by a specifier that would not resolve.
 */
export const vueAt = (frame: number) => frame >= B_COMMIT;

const ms = (f: number) => (f / FPS) * 1000;
export const seconds = ms(END) / 1000;
