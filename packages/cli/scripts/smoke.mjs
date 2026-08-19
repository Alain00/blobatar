/**
 * What a consumer gets, checked the way a consumer gets it: the built bin,
 * spawned under Node — the runtime npx uses — with the real library and the
 * real resvg prebuild. Prior art: the library package's own smoke.mjs.
 *
 * Plain .mjs on purpose: nothing may transpile it.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const bin = fileURLToPath(new URL("../dist/blobatar.mjs", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "blobatar-cli-"));

let failed = false;
const check = (name, fn) => {
  try {
    const detail = fn();
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    console.error(`✗ ${name} — ${err.message}`);
    failed = true;
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const cli = (args, input) =>
  spawnSync(process.execPath, [bin, ...args], {
    input: input === undefined ? undefined : Buffer.from(input),
  });

check("svg to stdout", () => {
  const r = cli(["alain"]);
  assert(r.status === 0, `exit ${r.status}: ${r.stderr}`);
  const svg = r.stdout.toString("utf8");
  assert(svg.startsWith("<svg"), `did not print SVG: ${svg.slice(0, 40)}`);
  return `${svg.length} chars`;
});

check("determinism", () => {
  assert(cli(["alain"]).stdout.equals(cli(["alain"]).stdout), "same name, different bytes");
  return "same in, same out";
});

check("png via -o (real resvg prebuild)", () => {
  const file = join(dir, "alain.png");
  const r = cli(["alain", "-o", file, "--size", "64"]);
  assert(r.status === 0, `exit ${r.status}: ${r.stderr}`);
  const bytes = readFileSync(file);
  assert(bytes[0] === 0x89 && bytes[1] === 0x50, "file has no PNG magic");
  return `${bytes.length} bytes`;
});

check("batch from stdin", () => {
  const out = join(dir, "batch");
  const r = cli(["--stdin", "-d", out], "alain\nsofia\n");
  assert(r.status === 0, `exit ${r.status}: ${r.stderr}`);
  const files = readdirSync(out).sort().join(",");
  assert(files === "alain.svg,sofia.svg", `wrote ${files}`);
  return files;
});

check("both generations answer, and differently (real v1 alias)", () => {
  // "sofia" moved bands between generations; "alain" landed in a silhouette
  // gen2 preserves byte-for-byte (ADR-0008), so it cannot tell the two apart.
  const one = cli(["sofia", "--gen", "1"]);
  const two = cli(["sofia", "--gen", "2"]);
  assert(one.status === 0, `gen 1 exit ${one.status}: ${one.stderr}`);
  assert(two.status === 0, `gen 2 exit ${two.status}: ${two.stderr}`);
  assert(!one.stdout.equals(two.stdout), "gen 1 and gen 2 rendered identical markup");
  assert(one.stdout.equals(cli(["sofia", "--gen", "1"]).stdout), "gen 1 not deterministic");
  return "gen 1 ≠ gen 2, both stable";
});

check("errors exit 1, stderr only", () => {
  const r = cli(["alain", "--hue", "999"]);
  assert(r.status === 1, `exit ${r.status}`);
  assert(r.stdout.length === 0, "stdout was not empty");
  assert(String(r.stderr).includes("hue must be between 0 and 360"), `stderr: ${r.stderr}`);
});

process.exit(failed ? 1 : 0);
