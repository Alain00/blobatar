/**
 * The real process, wired into the pure CLI and deciding nothing. Node APIs
 * only — the published bin runs under npx on machines that have never met bun.
 * The shebang is stamped by `scripts/build.ts`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";

import { Resvg } from "@resvg/resvg-js";
import { blobatar } from "blobatar";

import { version } from "../package.json";
import { run } from "./cli";

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
    render: blobatar,
    rasterize: async (svg, size) =>
      new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng(),
    version,
  },
);

// Not process.exit(): a forced exit can truncate PNG bytes still flushing
// through a pipe. With stdin consumed and no handles left, node exits on its
// own carrying this code.
process.exitCode = code;
