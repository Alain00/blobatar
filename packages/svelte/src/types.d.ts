import type { HTMLImgAttributes, SVGAttributes } from "svelte/elements";
import type {
  Animate,
  BlobatarOptions,
  Travel,
} from "blobatar/internal";

/**
 * Two rendering modes, and the props follow the mode — the same union core's
 * React component declares, for the same reason. `onload` should stop
 * type-checking the moment animation is on, because it stops firing.
 */
type StaticProps = {
  animate?: false;
  /** Present so the union can be destructured; ignored without `animate`. */
  travel?: undefined;
} & Omit<Omit<HTMLImgAttributes, "src">, "travel">;

type AnimatedProps = {
  animate: Animate;
  /** Whole-figure directional travel; requires `blobatar/motion.css`. */
  travel?: Travel;
} & Omit<
  SVGAttributes<SVGSVGElement>,
  "children" | "viewBox"
>;

export type BlobatarProps = {
  /**
   * Who the blobatar is for. A username, a display name, an email, a bot's
   * handle, a user id — any string, and the same string always renders the
   * same blobatar. The only required prop.
   */
  name: string;
} & Omit<BlobatarOptions, "travel"> &
  (StaticProps | AnimatedProps);
