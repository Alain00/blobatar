/**
 * The real process, wired into the pure CLI and deciding nothing. Node APIs
 * only — the published bin runs under npx on machines that have never met bun.
 * The shebang is stamped by `scripts/build.ts`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";

import { Resvg } from "@resvg/resvg-js";
import { blobatar as blobatar2 } from "blobatar/blob";
import { blobatar as blobatar1 } from "blobatar-v1/blob";

import { version } from "../package.json";
import { run, type RenderOptions } from "./cli";

/**
 * One renderer per generation, the same pairing `apps/api` deploys: package
 * majors select generations (ADR-0008), so `--gen 1` renders the frozen v1
 * major under its alias rather than an approximation of it. Typed over the
 * shared option surface — the two packages agree on everything a flag can
 * spell and are free to diverge on everything it cannot.
 */
type Renderer = (name: string, options?: RenderOptions) => string;
const RENDERERS: Record<1 | 2, Renderer> = {
  // The cast bridges the majors' nominal types: v1's Pose lacks fields v2
  // added, so the two `Expression` types never structurally unify. Safe here
  // because every value that reaches a renderer came out of the shared table,
  // which only speaks what both majors accept; the smoke test spawns the
  // built bin against both entries for real.
  1: blobatar1 as unknown as Renderer,
  2: blobatar2,
};

// `blobatar name | head -c 100`: the downstream end closes early and node
// raises EPIPE on the next stdout write. The Unix convention is a quiet
// success — the reader got everything it wanted.
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") process.exit(0);
  throw err;
});

const code = await run(
  {
    argv: process.argv.slice(2),
    readStdin: async () => {
      process.stdin.setEncoding("utf8");
      let input = "";
      for await (const chunk of process.stdin) input += chunk;
      return input;
    },
    stdoutIsTTY: Boolean(process.stdout.isTTY),
    writeStdout: (data) => void process.stdout.write(data),
    writeStderr: (text) => void process.stderr.write(text),
    writeFile: (path, data) => writeFile(path, data),
    mkdir: (dir) => mkdir(dir, { recursive: true }).then(() => undefined),
  },
  {
    render: (name, options, generation) => RENDERERS[generation](name, options),
    rasterize: async (svg, size) =>
      new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng(),
    version,
  },
);

// Not process.exit(): a forced exit can truncate PNG bytes still flushing
// through a pipe. With stdin consumed and no handles left, node exits on its
// own carrying this code.
process.exitCode = code;
