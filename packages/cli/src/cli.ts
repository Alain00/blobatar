/**
 * The whole CLI, as one pure function: every branch lives here, behind an
 * injected process seam, so `bun test` covers the flag/output/batch matrix
 * in-process. `main.ts` wires the real process and decides nothing.
 *
 * Runs under plain Node (>= 18) by design — no Bun-only APIs in this file —
 * because the published artifact's audience is npx. A deliberate, documented
 * exception to the repo's Bun-first preference.
 */
import { normalizeSeed } from "blobatar";
import {
  BadRequest,
  parseOptions,
  type Generation,
  type UrlOptions,
} from "render-core";

/**
 * What a render receives: the URL-spellable options, plus the one option the
 * terminal adds. `normalize` is deliberately not in the shared table — a URL
 * always normalizes, and the flag exists for local, case-sensitive ids — so it
 * joins here, in the transport, after the table has spoken.
 */
export type RenderOptions = UrlOptions & { normalize?: boolean };

/**
 * The PNG raster width when the caller names none. The table has no size
 * default — an omitted `size` leaves SVG markup that scales via CSS — but a
 * raster has to pick a number.
 */
const PNG_DEFAULT_SIZE = 256;

export interface CliIO {
  /** argv after the runtime and script entries. */
  argv: string[];
  readStdin(): Promise<string>;
  stdoutIsTTY: boolean;
  writeStdout(data: Uint8Array | string): void;
  writeStderr(text: string): void;
  writeFile(path: string, data: Uint8Array | string): Promise<void>;
  /** Recursive, like `mkdir -p`. */
  mkdir(dir: string): Promise<void>;
}

export interface CliDeps {
  /** `blobatar()` from the pinned generation's package — opaque bytes here. */
  render(name: string, options: RenderOptions, generation: Generation): string;
  /** SVG markup to PNG bytes at a pixel width. */
  rasterize(svg: string, size: number): Promise<Uint8Array>;
  /** The package version, for `--version`. */
  version: string;
}

export const USAGE = `Usage:
  blobatar <name>                          SVG to stdout
  blobatar <name> -o alain.svg             to a file; format from the extension
  blobatar <name> -o alain.png --size 512
  blobatar --stdin -d ./blobatars/         batch: one name per line on stdin

Options:
  --size <n>          8-1024, clamped. PNG: raster width (default 256). SVG: width/height attributes
  --background <v>    squircle | circle | square | none (default none, transparent)
  --hue <n>           lock the hue, degrees 0-360
  --tone <n>          lock the tone, 0-1 across the swatch set
  --expression <v>    idle | happy | sad | mad | surprised | wink | sleepy |
                      smug | unsure | scared | love | shy | sick | thinking
  --gen <n>           pin a generation, 1 or 2 (default 2)
  --title <text>      accessible name carried in the markup
  --no-normalize      keep the name's case/spacing (for case-sensitive ids)
  -o, --out <file>    write one blobatar to <file> (.svg or .png)
  -d, --dir <dir>     batch only: directory for one file per name
  --stdin             read names from stdin, one per line (requires -d)
  --format <v>        svg | png - for stdout pipes and batch (default svg)
  -h, --help          this text
  --version           print the version
`;

/**
 * Flags that carry one of the endpoint's URL params, spelled straight into the
 * shared table. A flag here and a query key there are the same word on
 * purpose: \`--tone 0.4\` and \`?tone=0.4\` must be one sentence.
 */
export const PARAM_FLAGS: Record<string, string> = {
  "--size": "size",
  "--background": "background",
  "--hue": "hue",
  "--tone": "tone",
  "--expression": "expression",
  "--gen": "gen",
  "--title": "title",
};

interface Parsed {
  name?: string;
  raw: URLSearchParams;
  noNormalize: boolean;
  out?: string;
  dir?: string;
  stdin: boolean;
  format?: "svg" | "png";
  help: boolean;
  version: boolean;
}

/** argv to a plain description of what was asked — no validation beyond shape. */
function parseArgv(argv: string[]): Parsed | { error: string } {
  const parsed: Parsed = {
    raw: new URLSearchParams(),
    noNormalize: false,
    stdin: false,
    help: false,
    version: false,
  };
  const take = (flag: string, inline: string | undefined, rest: string[]) => {
    if (inline !== undefined) return inline;
    const value = rest.shift();
    return value === undefined ? { error: `${flag} requires a value` } : value;
  };
  const positional = (token: string): { error: string } | undefined => {
    if (parsed.name !== undefined)
      return { error: `expected one name, got "${parsed.name}" and "${token}"` };
    parsed.name = token;
    return undefined;
  };

  const rest = [...argv];
  while (rest.length > 0) {
    const token = rest.shift()!;
    // The conventional end-of-options marker: everything after it is a name,
    // which is how a name like "-bot" gets rendered at all.
    if (token === "--") {
      for (const t of rest.splice(0)) {
        const err = positional(t);
        if (err) return err;
      }
      break;
    }
    // `--flag=value` is the same as `--flag value`.
    const eq = token.startsWith("--") ? token.indexOf("=") : -1;
    const flag = eq === -1 ? token : token.slice(0, eq);
    const inline = eq === -1 ? undefined : token.slice(eq + 1);

    if (flag === "-h" || flag === "--help") parsed.help = true;
    else if (flag === "--version") parsed.version = true;
    else if (flag === "--stdin") parsed.stdin = true;
    else if (flag === "--no-normalize") parsed.noNormalize = true;
    else if (Object.hasOwn(PARAM_FLAGS, flag)) {
      const value = take(flag, inline, rest);
      if (typeof value !== "string") return value;
      // `set`, not `append`: the last spelling of a repeated flag wins.
      parsed.raw.set(PARAM_FLAGS[flag]!, value);
    } else if (flag === "-o" || flag === "--out" || flag === "-d" || flag === "--dir" || flag === "--format") {
      const value = take(flag, inline, rest);
      if (typeof value !== "string") return value;
      if (flag === "--format") {
        if (value !== "svg" && value !== "png") return { error: "format must be svg or png" };
        parsed.format = value;
      } else if (flag === "-o" || flag === "--out") parsed.out = value;
      else parsed.dir = value;
    } else if (flag.startsWith("-") && flag !== "-") {
      return { error: `unknown option ${flag} (see blobatar --help)` };
    } else {
      const err = positional(token);
      if (err) return err;
    }
  }
  return parsed;
}

export async function run(io: CliIO, deps: CliDeps): Promise<0 | 1> {
  const fail = (message: string): 1 => {
    io.writeStderr(`blobatar: ${message}\n`);
    return 1;
  };

  const parsed = parseArgv(io.argv);
  if ("error" in parsed) return fail(parsed.error);
  if (parsed.help) {
    io.writeStdout(USAGE);
    return 0;
  }
  if (parsed.version) {
    io.writeStdout(`${deps.version}\n`);
    return 0;
  }

  // The same call the endpoint makes on a query string — same values, same
  // ranges, same error text, whichever surface the caller typed into.
  let request;
  try {
    request = parseOptions(parsed.raw);
  } catch (e) {
    if (e instanceof BadRequest) return fail(e.message);
    throw e;
  }
  const { generation } = request;
  const options: RenderOptions = parsed.noNormalize
    ? { ...request.options, normalize: false }
    : request.options;

  if (parsed.out !== undefined && parsed.dir !== undefined)
    return fail("-o and -d are mutually exclusive");
  if (parsed.stdin && parsed.name !== undefined)
    return fail("--stdin reads names from stdin; drop the positional name");
  if (parsed.stdin && parsed.dir === undefined) return fail("--stdin requires -d <dir>");
  if (!parsed.stdin && parsed.dir !== undefined)
    return fail("-d is for batches and requires --stdin (write one blobatar with -o)");

  if (parsed.stdin) {
    // Verbatim: trimming trailing slashes turns "-d /" into mkdir("") and a
    // Windows drive root into a relative path. The join below handles the
    // separator instead.
    const dir = parsed.dir!;
    const format = parsed.format ?? "svg";
    // An exact duplicate is the same blobatar twice — deduped, not an error.
    // A Set keeps insertion order, so output order still follows the input.
    const seen = new Set<string>();
    for (const line of (await io.readStdin()).split("\n")) {
      const name = line.trim();
      if (name !== "") seen.add(name);
    }
    const names = [...seen];
    if (names.length === 0) return fail("stdin carried no names");

    // Every filename is precomputed before anything touches disk: a collision
    // aborts the whole batch instead of silently overwriting a blobatar. The
    // grouping key is lowercased because on default macOS/Windows volumes two
    // casings are one file — the preflight must catch what the filesystem
    // would merge, which matters exactly when --no-normalize preserves case.
    const normalize = options.normalize !== false;
    const byFile = new Map<string, { file: string; owners: string[] }>();
    for (const name of names) {
      const file = `${filename(name, normalize)}.${format}`;
      const entry = byFile.get(file.toLowerCase());
      if (entry) entry.owners.push(name);
      else byFile.set(file.toLowerCase(), { file, owners: [name] });
    }
    const collisions = [...byFile.values()].filter((entry) => entry.owners.length > 1);
    if (collisions.length > 0)
      return fail(
        "filename collision — nothing written:\n" +
          collisions
            .map((e) => `  ${e.file}: ${e.owners.map((n) => JSON.stringify(n)).join(", ")}`)
            .join("\n"),
      );

    await io.mkdir(dir);
    for (const { file, owners } of byFile.values()) {
      const name = owners[0]!;
      const data =
        format === "svg"
          ? deps.render(name, options, generation)
          : await png(deps, name, options, generation);
      await io.writeFile(dir.endsWith("/") ? `${dir}${file}` : `${dir}/${file}`, data);
    }
    return 0;
  }

  const name = parsed.name;
  if (name === undefined) return fail("missing name (see blobatar --help)");

  let format: "svg" | "png";
  const out = parsed.out;
  if (out !== undefined) {
    // The extension decides; --format may only agree.
    const dot = out.lastIndexOf(".");
    const ext = dot === -1 ? "" : out.slice(dot + 1);
    if (ext !== "svg" && ext !== "png")
      return fail(`output file must end in .svg or .png, got "${out}"`);
    if (parsed.format !== undefined && parsed.format !== ext)
      return fail(`--format ${parsed.format} contradicts the .${ext} extension of ${out}`);
    format = ext;
  } else {
    format = parsed.format ?? "svg";
    // stdout carries only image bytes, and binary bytes ruin a terminal.
    if (format === "png" && io.stdoutIsTTY)
      return fail("PNG is binary — write it with -o <file>.png, or pipe stdout");
  }

  const data =
    format === "svg"
      ? deps.render(name, options, generation)
      : await png(deps, name, options, generation);
  if (out !== undefined) await io.writeFile(out, data);
  else io.writeStdout(data);
  return 0;
}

/** PNG bytes for one name: raster width from `size`, never markup attributes. */
async function png(
  deps: CliDeps,
  name: string,
  options: RenderOptions,
  generation: Generation,
): Promise<Uint8Array> {
  const { size, ...rest } = options;
  return deps.rasterize(deps.render(name, rest, generation), size ?? PNG_DEFAULT_SIZE);
}

/**
 * A batch output filename: the identity the render will hash — normalized
 * exactly when the render normalizes — made filesystem-safe. Deterministic,
 * so a re-run of the same list lands on the same files.
 */
function filename(name: string, normalize: boolean): string {
  const identity = normalize ? normalizeSeed(name) : name;
  return identity.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200);
}
