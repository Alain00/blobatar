import { expect, test, describe } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  defineComponent,
  h,
  type ComponentObjectPropsOptions,
} from "vue";
import { renderToString } from "vue/server-renderer";
import { renderToString as renderSolid } from "solid-js/web";
import { render as renderPreact } from "preact-render-to-string";
import { h as preactH } from "preact";
import { render as renderSvelte } from "svelte/server";
import { Blobatar as React_ } from "@blobatar/react";
import { Blobatar as Vue_ } from "@blobatar/vue";
import { Blobatar as Solid_ } from "@blobatar/solid";
import { Blobatar as Preact_ } from "@blobatar/preact";
import { Blobatar as Svelte_ } from "@blobatar/svelte";
// Before anything Angular: the adapter ships partially compiled (ng-packagr's
// library format), and outside an Angular CLI build it is the JIT compiler that
// links it, along with the host component `angular` below declares.
import "@angular/compiler";
import { Component, provideExperimentalZonelessChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideServerRendering, renderApplication } from "@angular/platform-server";
import { Blobatar as Angular_ } from "@blobatar/angular";
import { CASES } from "./cases";

/**
 * The adapters must agree.
 *
 * Imported by package name, not by relative path into `blobatar/src`. That is
 * the difference this file gained when it moved out of the library: it now
 * resolves each adapter through its own published `exports` map and its built
 * `dist`, so a broken export path or a build that drops the component fails
 * here rather than in a consumer's install. Nothing in this package aliases
 * `blobatar/*` back to source, deliberately — see `tsconfig.json`.
 *
 * An adapter owns the outer element and nothing else — it adds no geometry and
 * no defaults of its own — so two adapters handed the same name and the same
 * options have to produce the same blobatar. That is the whole contract, and
 * it is not self-enforcing: Vue's runtime props table can inject values the
 * caller never passed (a type list containing `Boolean` casts an omitted prop
 * to `false`), which is a way for an adapter to change the picture while
 * looking like it only re-expresses it.
 *
 * These compare rendered output rather than the options objects, because the
 * options object is exactly the thing a props table can quietly rewrite.
 */

/**
 * Three differences between the two SSR renderers that are not differences in
 * the blobatar, normalized away so a real one cannot hide behind them:
 *
 * - Quote escaping. React writes `&#x27;`, Vue writes `&#39;`; neither survives
 *   the parse.
 * - A trailing `;` on Vue's serialized style attribute.
 * - `<!---->` placeholders where a child is `null`. These are Vue's anchors for
 *   an unkeyed children list, and they are wanted: they hold the root `<g>` at
 *   a fixed index whether or not a `<title>` is present, so toggling `title`
 *   patches in place instead of shifting every sibling up one and rebuilding
 *   the subtree the morph lives in.
 */
const normalize = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCharCode(parseInt(x, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/<!---->/g, "")
    .replace(/;"/g, '"');

const react = (props: Record<string, unknown>) =>
  normalize(renderToStaticMarkup(createElement(React_ as never, props as never)));

const vue = async (props: Record<string, unknown>) =>
  normalize(await renderToString(h(Vue_ as never, props as never)));

/**
 * Three more renderers, each with its own bookkeeping in the output.
 *
 * Solid stamps `data-hk` hydration keys; Svelte writes `<!--[-->` block anchors,
 * a marker comment around every `{@html}`, and an empty `class` where a template
 * had none. Those are artifacts of how each framework resynchronizes markup it
 * later hydrates — the same category as Vue's `<!---->` above — and none of them
 * is part of the blobatar.
 *
 * Every comment goes, not an enumerated list of them: a comment is never part of
 * the picture, and matching the exact anchors would make this the place a
 * framework upgrade breaks rather than the place a blobatar regression shows.
 */
const artifacts = (s: string) =>
  s
    .replace(/ data-hk="[^"]*"/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/ class=""/g, "");

const solid = (props: Record<string, unknown>) =>
  artifacts(normalize(renderSolid(() => (Solid_ as never as (p: unknown) => unknown)(props))));

const preact = (props: Record<string, unknown>) =>
  artifacts(normalize(renderPreact(preactH(Preact_ as never, props as never))));

const svelte = (props: Record<string, unknown>) =>
  artifacts(normalize(renderSvelte(Svelte_ as never, { props } as never).body));

/**
 * Angular renders a whole application, not a component, so this bootstraps one
 * whose only template is the `<blobatar>` with each passed prop bound — and
 * only the passed ones, so an omitted input stays omitted exactly as it does in
 * the other renderers.
 *
 * Then it takes the markup back out of everything Angular put around it: the
 * document and the host element, the `display: contents` wrapper the server
 * path parses its `<svg>` inside (see the adapter's own note on why that path
 * exists), and the explicit closing tags its server DOM writes where core wrote
 * `/>` — the same parse-and-reserialize difference as the entities above.
 */
const angular = async (props: Record<string, unknown>) => {
  const bindings = Object.keys(props)
    .map((k) => `[${k}]="p.${k}"`)
    .join(" ");
  const Host = Component({
    selector: "app-root",
    standalone: true,
    imports: [Angular_],
    template: `<blobatar ${bindings} />`,
  })(
    class {
      p = props;
    },
  );
  const html = await renderApplication(
    // The context is required on the server since Angular's 19.2 security
    // patches (NG0401); typed loosely because older 19.x had no such parameter.
    (context?: unknown) =>
      bootstrapApplication(
        Host as never,
        { providers: [provideServerRendering(), provideExperimentalZonelessChangeDetection()] },
        context as never,
      ),
    { document: "<app-root></app-root>" },
  );
  const inner = html.match(/<blobatar\b[^>]*>([\s\S]*)<\/blobatar>/)?.[1] ?? "";
  const svg = inner.replace(/<span style="display: contents;">([\s\S]*)<\/span>/, "$1");
  // Only from the root `<g>` on: that subtree is core's string, which React
  // passes through verbatim, while the backdrop before it is an element React
  // itself serialized — with an explicit closing tag, as domino writes it.
  const root = svg.indexOf("<g");
  const ours = root < 0 ? svg : svg.slice(0, root);
  const core = root < 0 ? "" : svg.slice(root);
  return artifacts(
    normalize(ours + core.replace(/><\/(path|circle|ellipse|rect|line|polyline|polygon|stop|image)>/g, "/>")),
  );
};

/** The blobatar itself, out of whichever element carried it. */
const picture = (markup: string) => {
  const src = markup.match(/src="([^"]*)"/);
  return src ? decodeURIComponent(src[1]!) : markup;
};

const attr = (markup: string, name: string) =>
  markup.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

/**
 * Agreement is not enough on its own.
 *
 * Every assertion below compares one adapter against another, and two adapters
 * that both render nothing agree perfectly. That is not a hypothetical: the
 * first build of `@blobatar/react` in this workspace emitted
 * `export{a as Blobatar}` with no `a`, and PR #9's Preact adapter returned a
 * raw DOM node from a function component, which Preact dropped silently for an
 * empty string — with a clean typecheck and a green test suite in both cases.
 *
 * So each adapter is asserted to produce something before any of them are
 * compared. A new adapter gets a line here and in the case table below; either
 * alone leaves a hole.
 */
type Render = (p: Record<string, unknown>) => string | Promise<string>;

/**
 * The roster, in one place, because every table below reads from it — adding a
 * framework means adding a line here and nothing else. The comment above says a
 * new adapter needs a line in this list *and* in the case table; it needs one
 * line now, which is the version of that rule worth having.
 *
 * React is first and is the reference every other adapter is compared against.
 * That is arbitrary in principle — the contract is mutual agreement, not
 * agreement with React — and deliberate in practice: comparing each adapter
 * against one fixed other keeps a failure naming the adapter that broke, where
 * an all-pairs comparison would fail in n places and name none of them.
 */
const ADAPTERS: [string, Render][] = [
  ["@blobatar/react", react],
  ["@blobatar/vue", vue],
  ["@blobatar/solid", solid],
  ["@blobatar/preact", preact],
  ["@blobatar/svelte", svelte],
  ["@blobatar/angular", angular],
];

const OTHERS = ADAPTERS.filter(([name]) => name !== "@blobatar/react");

describe("every adapter renders a blobatar at all", () => {
  for (const [name, render] of ADAPTERS) {
    test(`${name}: static`, async () => {
      const markup = await render({ name: "alain" });
      expect(markup.length).toBeGreaterThan(0);
      expect(markup).toContain("data:image/svg+xml");
    });

    test(`${name}: animated`, async () => {
      const markup = await render({ name: "alain", animate: "always" });
      expect(markup.length).toBeGreaterThan(0);
      expect(markup).toContain("<svg");
    });
  }
});

/**
 * Cases the web adapters share and React Native cannot take, so they are not in
 * `CASES`, which both files read. `defs` is SVG markup, and `react-native-svg`
 * draws from elements — the prop is absent from that adapter's type, as
 * `animate` is, rather than accepted and ignored. `paint` goes with `defs`.
 */
const WEB_ONLY: [string, Record<string, unknown>][] = [
  [
    "a paint server",
    {
      name: "alain",
      defs: '<linearGradient id="sky"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#818cf8"/></linearGradient>',
      paint: "url(#sky)",
    },
  ],
  [
    "a paint server, a title and a backdrop",
    {
      name: "alain",
      title: "Alain",
      background: "circle",
      defs: '<pattern id="skin" patternUnits="userSpaceOnUse" width="100" height="100"><rect width="100" height="100" fill="#fde68a"/></pattern>',
      paint: "url(#skin)",
    },
  ],
];

describe("the adapters render the same blobatar", () => {
  for (const [what, props] of [...CASES, ...WEB_ONLY]) {
    for (const [name, render] of OTHERS) {
      test(`static: ${what} — ${name}`, async () => {
        expect(picture(await render(props))).toBe(picture(react(props)));
      });

      test(`animated: ${what} — ${name}`, async () => {
        const a = await render({ ...props, animate: "always" });
        const b = react({ ...props, animate: "always" });
        // The motion custom properties are seeded, so they are part of the
        // picture too — comparing the whole `<svg>` covers geometry and timing.
        expect(a).toBe(b);
      });
    }
  }
});

describe("attrs the caller passes win, in both modes", () => {
  // A caller who writes an explicit `width` or `role` is overriding what the
  // props derived. Both adapters spread caller attrs last, so both agree.
  const OVERRIDE = { name: "alain", size: 48, width: 96, height: 96, role: "presentation" };

  // Not Angular, which has nothing to spread: a component keeps its host
  // element, so an attribute the caller writes lands on `<blobatar>` itself and
  // never reaches the `<img>` or `<svg>` inside. Binding `[width]` there is a
  // template error (NG0303), not an override.
  const SPREADING = OTHERS.filter(([name]) => name !== "@blobatar/angular");

  for (const [name, render] of SPREADING) {
    test(`static — ${name}`, async () => {
      const a = await render(OVERRIDE);
      const b = react(OVERRIDE);
      expect(attr(a, "width")).toBe("96");
      expect(attr(a, "width")).toBe(attr(b, "width")!);
      expect(attr(a, "role")).toBe(attr(b, "role")!);
    });

    test(`animated — ${name}`, async () => {
      const props = { ...OVERRIDE, animate: "always" };
      const a = await render(props);
      const b = react(props);
      expect(attr(a, "width")).toBe("96");
      expect(attr(a, "role")).toBe("presentation");
      expect(attr(a, "width")).toBe(attr(b, "width")!);
      expect(attr(a, "role")).toBe(attr(b, "role")!);
    });
  }
});

describe("the adapter injects no option the caller did not pass", () => {
  /**
   * The one thing rendered output cannot check.
   *
   * Vue's props table can hand `setup` a value for a prop nobody passed — any
   * type list containing `Boolean` casts an omitted prop to `false` — and the
   * adapter forwards that into `BlobatarOptions` as though the caller had
   * asked for it. Today `background: false` happens to match what the `blob`
   * style already defaults to, so it renders identically and every comparison
   * above stays green. It would stop being invisible the moment a style ships
   * a backdrop, and it would surface as "Vue lost the backdrop" rather than as
   * anything pointing here.
   *
   * So this asserts the resolved props directly: omitted means `undefined`,
   * and the core stays the only place a default is written down.
   */
  const resolved = async (passed: Record<string, unknown>) => {
    let seen: Record<string, unknown> = {};
    const Spy = defineComponent({
      // The adapter's own props table, reused verbatim — the point is to
      // observe what Vue resolves *these declarations* to, so re-stating them
      // here would test a copy instead of the thing that ships.
      props: (Vue_ as unknown as { props: ComponentObjectPropsOptions }).props,
      setup(props) {
        seen = { ...(props as Record<string, unknown>) };
        return () => null;
      },
    });
    await renderToString(h(Spy, passed as never));
    return seen;
  };

  test("a bare call resolves to nothing but the name", async () => {
    const props = await resolved({ name: "alain" });
    expect(props).toEqual({ name: "alain" });
  });

  test("every option the caller omits stays undefined", async () => {
    const props = await resolved({ name: "alain", hue: 210 });
    const injected = Object.entries(props)
      .filter(([k]) => k !== "name" && k !== "hue")
      .filter(([, v]) => v !== undefined);
    expect(injected).toEqual([]);
  });
});
