import type { Animate } from "../animate";
import type { BlobatarOptions } from "../blobatar";

type StaticProps = { animate?: false } & Record<string, unknown>;

type AnimatedProps = { animate: Animate } & Record<string, unknown>;

export type BlobatarProps = {
  /**
   * Who the blobatar is for. A username, a display name, an email, a bot's
   * handle, a user id — any string, and the same string always renders the
   * same blobatar. The only required prop.
   */
  name: string;
} & BlobatarOptions &
  (StaticProps | AnimatedProps);
