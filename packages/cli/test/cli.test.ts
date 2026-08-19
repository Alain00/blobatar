/**
 * The whole flag/output/batch matrix, in-process through the injected process
 * seam (argv, stdin, stdout-TTY-ness, file writes). One end-to-end smoke
 * (`scripts/smoke.mjs`) spawns the built bin under node; param-table
 * correctness (values, ranges, messages) is render-core's suite — what is
 * asserted here is that flags reach that table and its answers reach the user.
 */
import { describe, expect, test } from "bun:test";

import { run, type CliDeps, type CliIO } from "../src/cli";

function cli(argv: string[], opts: { tty?: boolean; stdin?: string } = {}) {
  const out: (Uint8Array | string)[] = [];
  const err: string[] = [];
  const files = new Map<string, Uint8Array | string>();
  const dirs: string[] = [];
  const io: CliIO = {
    argv,
    readStdin: async () => opts.stdin ?? "",
    stdoutIsTTY: opts.tty ?? false,
    writeStdout: (data) => void out.push(data),
    writeStderr: (text) => void err.push(text),
    writeFile: async (path, data) => void files.set(path, data),
    mkdir: async (dir) => void dirs.push(dir),
  };
  const deps: CliDeps = {
    render: (name, options, generation) =>
      `<svg>${name}|g${generation}|${JSON.stringify(options)}</svg>`,
    rasterize: async (svg, size) => new TextEncoder().encode(`png@${size}|${svg}`),
    version: "0.0.0-test",
  };
  return { out, err, files, dirs, run: () => run(io, deps) };
}

const text = (chunks: (Uint8Array | string)[]) =>
  chunks.map((c) => (typeof c === "string" ? c : new TextDecoder().decode(c))).join("");

describe("single blobatar", () => {
  test("a name alone writes SVG to stdout, rendered by the default generation", async () => {
    const c = cli(["alain"]);
    expect(await c.run()).toBe(0);
    expect(text(c.out)).toBe("<svg>alain|g2|{}</svg>");
    expect(c.err).toEqual([]);
    expect(c.files.size).toBe(0);
  });

  test("flags mirror the endpoint's URL params into the same options", async () => {
    const c = cli([
      "alain",
      "--background", "circle",
      "--hue", "210",
      "--tone", "0.4",
      "--expression", "happy",
      "--size", "512",
      "--title", "Alain",
      "--no-normalize",
    ]);
    expect(await c.run()).toBe(0);
    const options = JSON.parse(text(c.out).split("|")[2]!.replace("</svg>", ""));
    expect(options).toMatchObject({
      background: "circle",
      hue: 210,
      tone: 0.4,
      size: 512,
      title: "Alain",
      normalize: false,
    });
    expect(options.expression).toBeDefined();
  });

  test("--gen pins the generation the renderer receives", async () => {
    const one = cli(["alain", "--gen", "1"]);
    expect(await one.run()).toBe(0);
    expect(text(one.out)).toBe("<svg>alain|g1|{}</svg>");
    const two = cli(["alain", "--gen", "2"]);
    expect(await two.run()).toBe(0);
    expect(text(two.out)).toBe("<svg>alain|g2|{}</svg>");
  });

  test("an unknown generation fails with the table's roster", async () => {
    const c = cli(["alain", "--gen", "3"]);
    expect(await c.run()).toBe(1);
    expect(c.err.join("")).toContain('unknown gen "3" — expected one of 1, 2');
  });

  test("the full expression roster is spellable, not the old four", async () => {
    for (const pose of ["smug", "thinking", "wink", "scared"]) {
      const c = cli(["alain", "--expression", pose]);
      expect(await c.run()).toBe(0);
    }
    const typo = cli(["alain", "--expression", "smugg"]);
    expect(await typo.run()).toBe(1);
    expect(typo.err.join("")).toContain('unknown expression "smugg"');
    expect(typo.err.join("")).toContain("thinking");
  });

  test("tone speaks the glossary's 0–1, and an exact 1 stays in the last swatch", async () => {
    // The table clamps just inside the half-open top bucket — see render-core.
    const c = cli(["alain", "--tone", "1"]);
    expect(await c.run()).toBe(0);
    expect(text(c.out)).toContain('"tone":0.999999');
    // The old 0–100 dialect is gone: 40 is now out of range, loudly.
    const old = cli(["alain", "--tone", "40"]);
    expect(await old.run()).toBe(1);
    expect(old.err.join("")).toContain("tone must be between 0 and 1, got 40");
  });

  test("size clamps like the endpoint clamps, and non-numbers are dropped", async () => {
    const big = cli(["alain", "--size", "2048"]);
    expect(await big.run()).toBe(0);
    expect(text(big.out)).toContain('"size":1024');
    const small = cli(["alain", "--size", "4"]);
    expect(await small.run()).toBe(0);
    expect(text(small.out)).toContain('"size":8');
    // The endpoint ignores an unparseable size rather than erroring; the same
    // table gives the CLI the same answer.
    const junk = cli(["alain", "--size", "abc"]);
    expect(await junk.run()).toBe(0);
    expect(text(junk.out)).toBe("<svg>alain|g2|{}</svg>");
  });

  test("hue is a number, not digits — floats fine, bounds enforced", async () => {
    const c = cli(["alain", "--hue", "210.5"]);
    expect(await c.run()).toBe(0);
    expect(text(c.out)).toContain('"hue":210.5');
    const over = cli(["alain", "--hue", "999"]);
    expect(await over.run()).toBe(1);
    expect(over.err.join("")).toContain("hue must be between 0 and 360, got 999");
  });

  test("--title is capped by the table", async () => {
    const c = cli(["alain", "--title", "a".repeat(129)]);
    expect(await c.run()).toBe(1);
    expect(c.err.join("")).toContain("title must be 128 characters or fewer");
  });

  test("--flag=value works like --flag value", async () => {
    const c = cli(["alain", "--hue=210"]);
    expect(await c.run()).toBe(0);
    expect(text(c.out)).toContain('"hue":210');
  });

  test("an invalid value fails with the table's message, stdout untouched", async () => {
    const c = cli(["alain", "--hue", "999"]);
    expect(await c.run()).toBe(1);
    expect(c.out).toEqual([]);
    expect(text(c.err as unknown as string[])).toContain("hue must be between 0 and 360");
  });

  test("a value-taking flag with nothing after it fails", async () => {
    const c = cli(["alain", "--hue"]);
    expect(await c.run()).toBe(1);
    expect(c.err.join("")).toContain("--hue requires a value");
  });

  test("an unknown option fails loudly", async () => {
    const c = cli(["alain", "--palette", "red"]);
    expect(await c.run()).toBe(1);
    expect(c.err.join("")).toContain("unknown option --palette");
  });

  test("-- ends option parsing, so hyphen-led names render", async () => {
    const c = cli(["--", "-bot"]);
    expect(await c.run()).toBe(0);
    expect(text(c.out)).toBe("<svg>-bot|g2|{}</svg>");
    // Flags before the marker still work.
    const d = cli(["--hue", "210", "--", "--stdin"]);
    expect(await d.run()).toBe(0);
    expect(text(d.out)).toBe('<svg>--stdin|g2|{"hue":210}</svg>');
  });
});

describe("-o", () => {
  test("the .svg extension writes markup to the file, nothing to stdout", async () => {
    const c = cli(["alain", "-o", "alain.svg"]);
    expect(await c.run()).toBe(0);
    expect(c.out).toEqual([]);
    expect(c.files.get("alain.svg")).toBe("<svg>alain|g2|{}</svg>");
  });

  test("the .png extension rasterizes at 256 by default, size never in markup", async () => {
    const c = cli(["alain", "-o", "alain.png"]);
    expect(await c.run()).toBe(0);
    expect(text([c.files.get("alain.png")!])).toBe("png@256|<svg>alain|g2|{}</svg>");
  });

  test("--size sets the PNG raster width", async () => {
    const c = cli(["alain", "-o", "alain.png", "--size", "512"]);
    expect(await c.run()).toBe(0);
    expect(text([c.files.get("alain.png")!])).toBe("png@512|<svg>alain|g2|{}</svg>");
  });

  test("any other extension is an error", async () => {
    const c = cli(["alain", "-o", "alain.webp"]);
    expect(await c.run()).toBe(1);
    expect(c.err.join("")).toContain("must end in .svg or .png");
    expect(c.files.size).toBe(0);
  });

  test("a --format contradicting the extension is an error", async () => {
    const c = cli(["alain", "-o", "alain.png", "--format", "svg"]);
    expect(await c.run()).toBe(1);
    expect(c.err.join("")).toContain("contradicts");
    expect(c.files.size).toBe(0);
  });

  test("a --format agreeing with the extension is fine", async () => {
    const c = cli(["alain", "-o", "alain.svg", "--format", "svg"]);
    expect(await c.run()).toBe(0);
    expect(c.files.has("alain.svg")).toBe(true);
  });
});

describe("PNG on stdout", () => {
  test("never lands on a TTY", async () => {
    const c = cli(["alain", "--format", "png"], { tty: true });
    expect(await c.run()).toBe(1);
    expect(c.out).toEqual([]);
    expect(c.err.join("")).toContain("-o");
  });

  test("flows into a pipe with --format png", async () => {
    const c = cli(["alain", "--format", "png"], { tty: false });
    expect(await c.run()).toBe(0);
    expect(text(c.out)).toBe("png@256|<svg>alain|g2|{}</svg>");
  });

  test("SVG is fine on a TTY", async () => {
    const c = cli(["alain"], { tty: true });
    expect(await c.run()).toBe(0);
    expect(text(c.out)).toBe("<svg>alain|g2|{}</svg>");
  });
});

describe("mode exclusions", () => {
  const fails = async (argv: string[], fragment: string, stdin?: string) => {
    const c = cli(argv, { stdin });
    expect(await c.run()).toBe(1);
    expect(c.err.join("")).toContain(fragment);
    expect(c.out).toEqual([]);
    expect(c.files.size).toBe(0);
  };

  test("-o and -d are mutually exclusive", () =>
    fails(["alain", "-o", "a.svg", "-d", "out"], "mutually exclusive"));
  test("--stdin excludes a positional name", () =>
    fails(["alain", "--stdin", "-d", "out"], "--stdin"));
  test("--stdin requires -d", () => fails(["--stdin"], "-d", "alain\n"));
  test("-d requires --stdin", () => fails(["alain", "-d", "out"], "--stdin"));
  test("no name and no --stdin is a usage error", () => fails([], "missing name"));
});

describe("batch", () => {
  test("one file per name, trimmed, empty lines skipped", async () => {
    const c = cli(["--stdin", "-d", "blobatars"], { stdin: "alain\n\n  sofia  \nbot-7\n" });
    expect(await c.run()).toBe(0);
    expect(c.dirs).toEqual(["blobatars"]);
    expect([...c.files.keys()].sort()).toEqual([
      "blobatars/alain.svg",
      "blobatars/bot-7.svg",
      "blobatars/sofia.svg",
    ]);
    expect(c.files.get("blobatars/alain.svg")).toBe("<svg>alain|g2|{}</svg>");
    expect(c.out).toEqual([]);
  });

  test("--format png rasterizes the whole batch", async () => {
    const c = cli(["--stdin", "-d", "out", "--format", "png", "--size", "64"], {
      stdin: "alain\n",
    });
    expect(await c.run()).toBe(0);
    expect(text([c.files.get("out/alain.png")!])).toBe("png@64|<svg>alain|g2|{}</svg>");
  });

  test("--gen carries into every render of the batch", async () => {
    const c = cli(["--stdin", "-d", "out", "--gen", "1"], { stdin: "alain\nsofia\n" });
    expect(await c.run()).toBe(0);
    expect(c.files.get("out/alain.svg")).toBe("<svg>alain|g1|{}</svg>");
    expect(c.files.get("out/sofia.svg")).toBe("<svg>sofia|g1|{}</svg>");
  });

  test("filenames are the sanitized identity the render will hash", async () => {
    const c = cli(["--stdin", "-d", "out"], { stdin: "User@Example.com\n" });
    expect(await c.run()).toBe(0);
    // Normalized like the render normalizes, then charset-safe.
    expect([...c.files.keys()]).toEqual(["out/user_example.com.svg"]);
  });

  test("--no-normalize keeps the verbatim identity in the filename", async () => {
    const c = cli(["--stdin", "-d", "out", "--no-normalize"], { stdin: "UserA\n" });
    expect(await c.run()).toBe(0);
    expect([...c.files.keys()]).toEqual(["out/UserA.svg"]);
  });

  test("long names cap at 200 characters plus the extension", async () => {
    const c = cli(["--stdin", "-d", "out"], { stdin: `${"a".repeat(250)}\n` });
    expect(await c.run()).toBe(0);
    const [file] = [...c.files.keys()];
    expect(file).toBe(`out/${"a".repeat(200)}.svg`);
  });

  test("an exact duplicate line is one blobatar, not a collision", async () => {
    const c = cli(["--stdin", "-d", "out"], { stdin: "alain\nalain\n" });
    expect(await c.run()).toBe(0);
    expect(c.files.size).toBe(1);
  });

  test("distinct names mapping to one filename abort before anything is written", async () => {
    const c = cli(["--stdin", "-d", "out"], { stdin: "sofia\nAlain\nalain\nuser@x\nuser_x\n" });
    expect(await c.run()).toBe(1);
    // The error lists every conflicting name; nothing was partially written.
    const err = c.err.join("");
    expect(err).toContain("collision");
    expect(err).toContain("Alain");
    expect(err).toContain("alain");
    expect(err).toContain("user@x");
    expect(err).toContain("user_x");
    expect(c.files.size).toBe(0);
    expect(c.dirs).toEqual([]);
  });

  test("an empty stdin is an error, not a silent success", async () => {
    const c = cli(["--stdin", "-d", "out"], { stdin: "\n\n" });
    expect(await c.run()).toBe(1);
    expect(c.err.join("")).toContain("no names");
  });

  test("a trailing slash on -d does not double up, and a bare root survives", async () => {
    const c = cli(["--stdin", "-d", "out/"], { stdin: "alain\n" });
    expect(await c.run()).toBe(0);
    expect([...c.files.keys()]).toEqual(["out/alain.svg"]);
    // "-d /" must stay the root, not become mkdir("").
    const d = cli(["--stdin", "-d", "/"], { stdin: "alain\n" });
    expect(await d.run()).toBe(0);
    expect(d.dirs).toEqual(["/"]);
    expect([...d.files.keys()]).toEqual(["/alain.svg"]);
  });

  test("names differing only by case collide — case-insensitive filesystems", async () => {
    // On default macOS/Windows volumes "UserA.svg" and "usera.svg" are one
    // file: the second write would silently clobber the first, defeating the
    // preflight exactly when --no-normalize is preserving case-sensitive ids.
    const c = cli(["--stdin", "-d", "out", "--no-normalize"], { stdin: "UserA\nusera\n" });
    expect(await c.run()).toBe(1);
    const err = c.err.join("");
    expect(err).toContain("collision");
    expect(err).toContain("UserA");
    expect(err).toContain("usera");
    expect(c.files.size).toBe(0);
  });
});

describe("--help and --version", () => {
  test("--help prints usage to stdout and exits 0", async () => {
    const c = cli(["--help"]);
    expect(await c.run()).toBe(0);
    expect(text(c.out)).toContain("Usage:");
    expect(c.err).toEqual([]);
  });

  test("--version prints the version", async () => {
    const c = cli(["--version"]);
    expect(await c.run()).toBe(0);
    expect(text(c.out)).toBe("0.0.0-test\n");
  });
});
