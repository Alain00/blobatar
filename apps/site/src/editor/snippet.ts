/**
 * The generator.
 *
 * The snippet is the page's deliverable — the tuned blobatar on screen is the
 * demonstration, this is the thing you leave with — so this is the one piece
 * here with a correctness property worth pinning, and `snippet.test.ts` pins
 * it: paste the output, render it, get the blobatar that was on screen.
 *
 * Pure, and separate from the panel for exactly that reason. A generator living
 * inside the component would be testable only by rendering one.
 */
import type { TraitOverrides } from "blobatar";
import { KEY_ORDER } from "./axes";

export type Api = "http" | "react" | "vue" | "svelte" | "solid" | "preact" | "string";
export type Motion = false | "hover" | "always";

export interface SnippetInput {
  api: Api;
  /** The name the preview is showing. Emitted literally — see `nameNote`. */
  name: string;
  /** The pinned traits. Empty means no `traits` at all in the output. */
  pinned: TraitOverrides;
  motion: Motion;
}

/**
 * `shape` is a valid identifier and `"eye.gap"` is not.
 *
 * Quoting every key would be uniform and slightly uglier; both are defensible
 * and the rule is to pick one. This picks the one a person writing the object
 * by hand would produce, since looking hand-written is the whole brief.
 */
const bare = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const key = (k: string) => (bare.test(k) ? k : JSON.stringify(k));

/**
 * Panel order, then anything else.
 *
 * The fallback is not dead code: it is what keeps an unknown key — one added to
 * `AXES` and forgotten here, or one restored from a config someone hand-edited
 * — in the output instead of silently dropped.
 */
function entries(pinned: TraitOverrides) {
  const known = KEY_ORDER.filter(k => k in pinned);
  const rest = Object.keys(pinned).filter(k => !KEY_ORDER.includes(k));
  return [...known, ...rest].map(k => [k, pinned[k]!] as const);
}

/**
 * A pinned value, as it is written in code.
 *
 * A list is the silhouette narrowed to several rather than fixed to one, and it
 * is emitted as a list — the library reads it directly, so the snippet stays an
 * object literal you can paste and hand-edit. That is the whole reason the
 * feature is a widened value type rather than a helper the editor generates a
 * call to: a generated `pickFrom(name, [...])` would be code you have to
 * understand before you can change it.
 */
const literal = (v: number | number[]) =>
  Array.isArray(v) ? `[${v.join(", ")}]` : String(v);

/**
 * JSX attribute strings are not JS strings — no backslash escapes — so a name
 * containing a quote cannot be written as `name="…"` at all. Fall through to an
 * expression container, where the JS literal `JSON.stringify` produces is
 * exactly right. Same helper as the hero's, same reason.
 */
const attr = (value: string) =>
  /["\\]/.test(value) ? `{${JSON.stringify(value)}}` : `"${value}"`;

/**
 * The name is emitted literally, and it has to be.
 *
 * A real call site says `name={user.email}`, and the temptation is to emit that
 * — but every axis left unpinned still comes from the name, so a snippet that
 * substitutes a variable for the string the preview used renders a different
 * blobatar. The literal is the honest output; the comment is what tells you
 * which half of it is yours to replace.
 */
const nameNote = "// everything below comes from the name unless it is pinned";

export function snippet({ api, name, pinned, motion }: SnippetInput): string {
  const traits = entries(pinned);
  const seed = name || "blobatar";

  switch (api) {
    case "http":
      return http(seed, traits, motion);
    case "react":
      return react(seed, traits, motion);
    case "vue":
      return vue(seed, traits, motion);
    case "svelte":
      return svelte(seed, traits, motion);
    case "solid":
      return solid(seed, traits, motion);
    case "preact":
      return preact(seed, traits, motion);
    case "string":
    default:
      return string(seed, traits, motion);
  }
}

function react(
  seed: string,
  traits: (readonly [string, number | number[]])[],
  motion: Motion,
) {
  const lines = [`import { Blobatar } from "blobatar/react";`];
  // The trade the library documents, stated where it is taken rather than in
  // prose beside the box: animating is what moves the blobatar out of a single
  // `<img>` and into a dozen inline SVG nodes.
  if (motion)
    lines.push(
      `import "blobatar/motion.css"; // animate renders inline SVG, not one <img>`,
    );

  lines.push("");
  if (traits.length) lines.push(nameNote);

  lines.push(`<Blobatar`, `  name=${attr(seed)}`);
  // One key inline, several over lines. A person writing `{ shape: 0.14 }`
  // does not break it across four lines, and a person writing six of them does
  // not leave it on one.
  if (traits.length === 1) {
    const [k, v] = traits[0]!;
    lines.push(`  traits={{ ${key(k)}: ${literal(v)} }}`);
  } else if (traits.length) {
    lines.push(`  traits={{`);
    for (const [k, v] of traits) lines.push(`    ${key(k)}: ${literal(v)},`);
    lines.push(`  }}`);
  }

  if (motion) lines.push(`  animate="${motion}"`);
  lines.push(`/>;`);

  return lines.join("\n");
}

function vue(
  seed: string,
  traits: (readonly [string, number | number[]])[],
  motion: Motion,
) {
  const lines = [`<script setup>`, `import Blobatar from "blobatar/vue";`, `</script>`, ""];

  if (motion)
    lines.push(`<!-- animate renders inline SVG, not one <img> -->`);

  if (traits.length) lines.push(nameNote);

  lines.push(`<template>`);
  lines.push(`  <Blobatar`);

  if (traits.length === 1) {
    const [k, v] = traits[0]!;
    lines.push(`    name="${seed}"`);
    lines.push(`    :traits="{ ${key(k)}: ${v} }"`);
  } else if (traits.length) {
    lines.push(`    name="${seed}"`);
    lines.push(`    :traits="{`);
    for (const [k, v] of traits) lines.push(`      ${key(k)}: ${v},`);
    lines.push(`    }"`);
  } else {
    lines.push(`    name="${seed}"`);
  }

  if (motion) lines.push(`    animate="${motion}"`);
  lines.push(`  />`);
  lines.push(`</template>`);

  return lines.join("\n");
}

function svelte(
  seed: string,
  traits: (readonly [string, number | number[]])[],
  motion: Motion,
) {
  const lines = [`<script>`, `  import Blobatar from "blobatar/svelte";`, `</script>`, ""];

  if (motion)
    lines.push(`<!-- animate renders inline SVG, not one <img> -->`);

  if (traits.length) lines.push(`<!-- ${nameNote} -->`);

  if (traits.length === 1) {
    const [k, v] = traits[0]!;
    lines.push(`<Blobatar name="${seed}" traits={{ ${key(k)}: ${v} }}${motion ? ` animate="${motion}"` : ""} />`);
  } else if (traits.length) {
    lines.push(`<Blobatar`);
    lines.push(`  name="${seed}"`);
    lines.push(`  traits={{`);
    for (const [k, v] of traits) lines.push(`    ${key(k)}: ${v},`);
    lines.push(`  }}${motion ? `\n  animate="${motion}"` : ""}`);
    lines.push(`/>`);
  } else {
    lines.push(`<Blobatar name="${seed}"${motion ? ` animate="${motion}"` : ""} />`);
  }

  return lines.join("\n");
}

function solid(
  seed: string,
  traits: (readonly [string, number | number[]])[],
  motion: Motion,
) {
  const lines = [`import { Blobatar } from "blobatar/solid";`];

  if (motion)
    lines.push(
      `import "blobatar/motion.css"; // animate renders inline SVG, not one <img>`,
    );

  lines.push("");
  if (traits.length) lines.push(nameNote);

  lines.push(`<Blobatar`);

  if (traits.length === 1) {
    const [k, v] = traits[0]!;
    lines.push(`  name="${seed}"`);
    lines.push(`  traits={{ ${key(k)}: ${v} }}`);
  } else if (traits.length) {
    lines.push(`  name="${seed}"`);
    lines.push(`  traits={{`);
    for (const [k, v] of traits) lines.push(`    ${key(k)}: ${v},`);
    lines.push(`  }}`);
  } else {
    lines.push(`  name="${seed}"`);
  }

  if (motion) lines.push(`  animate="${motion}"`);
  lines.push(`/>`);

  return lines.join("\n");
}

function preact(
  seed: string,
  traits: (readonly [string, number | number[]])[],
  motion: Motion,
) {
  const lines = [`import { Blobatar } from "blobatar/preact";`];

  if (motion)
    lines.push(
      `import "blobatar/motion.css"; // animate renders inline SVG, not one <img>`,
    );

  lines.push("");
  if (traits.length) lines.push(nameNote);

  lines.push(`<Blobatar`);

  if (traits.length === 1) {
    const [k, v] = traits[0]!;
    lines.push(`  name="${seed}"`);
    lines.push(`  traits={{ ${key(k)}: ${v} }}`);
  } else if (traits.length) {
    lines.push(`  name="${seed}"`);
    lines.push(`  traits={{`);
    for (const [k, v] of traits) lines.push(`    ${key(k)}: ${v},`);
    lines.push(`  }}`);
  } else {
    lines.push(`  name="${seed}"`);
  }

  if (motion) lines.push(`  animate="${motion}"`);
  lines.push(`/>`);

  return lines.join("\n");
}

function string(
  seed: string,
  traits: (readonly [string, number | number[]])[],
  motion: Motion,
) {
  const lines = [`import { blobatar } from "blobatar";`];
  lines.push("");

  // `animate` is honored by `blobatar/react` only — the string API returns
  // static markup whatever it is passed. Dropping it silently on the way over
  // would make this snippet a quieter blobatar than the one on screen, so it is
  // dropped out loud.
  if (motion)
    lines.push(`// animate is a blobatar/react option — this renders static markup`);
  if (traits.length) lines.push(nameNote);

  // Named `seed` here where the component takes `name`: same value, and the
  // words differ because they are read in different positions. See CONTEXT.md.
  const call = `const svg = blobatar(${JSON.stringify(seed)}`;

  if (!traits.length) return [...lines, `${call});`].join("\n");

  lines.push(`${call}, {`);
  if (traits.length) {
    lines.push(`  traits: {`);
    for (const [k, v] of traits) lines.push(`    ${key(k)}: ${literal(v)},`);
    lines.push(`  },`);
  }
  lines.push(`});`);

  return lines.join("\n");
}

/**
 * The endpoint, and the one API here that cannot carry everything the panel
 * pins.
 *
 * A URL's surface is `hue`, `tone`, `size`, `background`, `expression` and
 * `gen` — there is no spelling for a silhouette or an eye gap, and there should
 * not be: those are a geometry vocabulary, and putting forty trait positions in
 * a query string would make every one of them a public parameter of a service
 * anybody can link. So this emits what survives, and names what does not
 * directly above the URL. A snippet that quietly rendered a different blobatar
 * than the preview would be worse than one that says which axes it dropped.
 *
 * `gen` is pinned, unlike in the two library snippets, and for the mirror of
 * the reason they do not: there, the installed major selects the vocabulary and
 * the lockfile holds it still. A URL has no lockfile — an unversioned one
 * follows whatever the endpoint currently serves — so naming the generation is
 * how a pasted link keeps rendering the blobatar that was on screen. It is also
 * what earns the year-long immutable cache. See the endpoint's usage text.
 */
const ENDPOINT = "https://blobatar.dev/avatar/";

/** The generation the editor previews, which is the package it is built on. */
const GEN = 2;

/**
 * The pinned keys a URL can carry, in the units it spells them in.
 *
 * `hue` is degrees there and a position here — the library reads the trait as
 * `t.num("hue", 0, 360)`, so the conversion is the multiply and nothing else.
 * Two decimals is exact rather than approximate: pinning rounds to three, and
 * any three-decimal position times 360 lands on a multiple of 0.36.
 */
const URL_UNITS: Record<string, (v: number) => string> = {
  hue: v => String(Math.round(v * 36000) / 100),
  tone: String,
};

function http(
  seed: string,
  traits: (readonly [string, number | number[]])[],
  motion: Motion,
) {
  const query = [`gen=${GEN}`];
  const dropped: string[] = [];
  for (const [k, v] of traits) {
    const unit = URL_UNITS[k];
    // A narrowed axis is dropped whether or not the URL can spell the key: a
    // query parameter states one value, and "any of these" is not one. The two
    // keys a URL carries are colour and neither is narrowable from the panel,
    // so this is a guard rather than a case — but it is the guard that keeps a
    // silently wrong `tone=0.1,0.9` from ever being possible.
    if (unit && !Array.isArray(v)) query.push(`${k}=${unit(v)}`);
    else dropped.push(k);
  }

  // Only what the URL cannot say for itself. There is no line explaining `gen`
  // or the name, because both are right there in the URL being explained — a
  // comment on every snippet is a comment nobody reads by the third one. What
  // is left is the two things a reader cannot see: the axes that did not fit,
  // and the motion the endpoint will not serve.
  //
  // Short lines on purpose: this box is the narrow column on the page, and a
  // note that needs scrolling sideways to finish is another one nobody reads.
  const lines: string[] = [];
  if (dropped.length) lines.push(`# no url spelling for ${dropped.join(", ")} — from the name`);
  if (motion) lines.push(`# static svg — animate is a blobatar/react option`);

  lines.push(`${ENDPOINT}${encodeURIComponent(seed)}?${query.join("&")}`);
  return lines.join("\n");
}
