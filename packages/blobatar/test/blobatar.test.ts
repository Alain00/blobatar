import { describe, expect, test } from "bun:test";
import { _layout, _parts, blobatar } from "../src/blobatar";
import { VERSION } from "../src/index";
import { blobatarUri } from "../src/uri";
import { contrast, fromHex, palette } from "../src/color";
import { happy, mad } from "../src/expression";

const SEEDS = Array.from({ length: 300 }, (_, i) => `user-${i}`);

describe("output", () => {
  test("is well-formed SVG with no numeric leakage", () => {
    for (const s of SEEDS) {
      const svg = blobatar(s);
      expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"');
      expect(svg).toEndWith("</svg>");
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("undefined");
      expect(svg).not.toContain("Infinity");
    }
  });

  test("parses as XML", () => {
    // Bun ships no DOM parser, so lean on a structural check: tags balance.
    for (const s of SEEDS.slice(0, 50)) {
      const svg = blobatar(s);
      const open = (svg.match(/<(?!\/)[a-z]/g) ?? []).length;
      const close = (svg.match(/<\/[a-z]/g) ?? []).length + (svg.match(/\/>/g) ?? []).length;
      expect(open).toBe(close);
    }
  });

  test("emits no ids, so many blobatars on one page cannot collide", () => {
    for (const s of SEEDS.slice(0, 50)) {
      expect(blobatar(s)).not.toContain("id=");
      expect(blobatar(s)).not.toContain("url(#");
    }
  });

  test("stays small enough to inline", () => {
    const sizes = SEEDS.map(s => blobatar(s).length);
    expect(Math.max(...sizes)).toBeLessThan(2600);
  });
});

describe("options", () => {
  test("size adds explicit dimensions", () => {
    expect(blobatar("a", { size: 64 })).toContain('width="64" height="64"');
    expect(blobatar("a")).not.toContain("width=");
  });

  test("background toggles the backdrop plate", () => {
    const on = blobatar("a", { background: true }).match(/<path/g)!.length;
    const off = blobatar("a", { background: false }).match(/<path/g)!.length;
    expect(on).toBe(off + 1);
  });

  test("the default is no backdrop at all", () => {
    // The body *is* the blobatar, so nothing is drawn behind it unless asked.
    expect(blobatar("a").match(/<path/g)!.length).toBe(
      blobatar("a", { background: false }).match(/<path/g)!.length,
    );
  });

  test("hue and tone lock color while leaving shape seed-driven", () => {
    // Feature presence varies by seed, so the *set* of colors used differs.
    // What must hold is that no color outside the locked palette appears.
    const allowed = new Set(Object.values(palette(200, true, 0.5)));
    for (const s of SEEDS.slice(0, 50)) {
      for (const hex of blobatar(s, { hue: 200, tone: 0.5 }).match(/#[0-9a-f]{6}/g) ?? []) {
        expect(allowed).toContain(hex);
      }
    }
    expect(blobatar("alain", { hue: 200, tone: 0.5 })).not.toBe(
      blobatar("bob", { hue: 200, tone: 0.5 }),
    );
  });

  test("palette overrides are applied verbatim", () => {
    expect(blobatar("a", { palette: { head: "#ff0000" } })).toContain("#ff0000");
  });

  test("backgroundColor sets the backdrop fill", () => {
    expect(
      blobatar("a", { background: true, backgroundColor: "#123456" }),
    ).toContain('fill="#123456"');
  });

  test("backgroundColor does nothing without a backdrop", () => {
    expect(blobatar("a", { backgroundColor: "#123456" })).not.toContain("#123456");
  });

  test("an explicit palette.bg wins over backgroundColor", () => {
    expect(
      blobatar("a", {
        background: true,
        backgroundColor: "#123456",
        palette: { bg: "#abcdef" },
      }),
    ).toContain('fill="#abcdef"');
  });

  test("backgroundColor reaches the contrast floors", () => {
    // The floors themselves are swept in `color.test.ts`; this is the wiring.
    // A plate the exact color of the body is the worst case there is: without
    // the floor the blobatar would be a face floating on a disc.
    const opts = { background: "circle" } as const;
    const head = _layout("a", opts).palette.head!;
    const p = _layout("a", { ...opts, backgroundColor: head }).palette;
    expect(p.bg).toBe(head);
    expect(p.head).not.toBe(head);
    // Read back from hex, so a hair under the floor the ramp clears exactly.
    expect(contrast(fromHex(p.head!), fromHex(head))).toBeGreaterThan(1.24);
  });

  test("backgroundColor leaves the figure alone without a backdrop", () => {
    // Not merely "the color is not drawn": a plate that is not on screen must
    // not move the body either.
    for (const s of SEEDS.slice(0, 50)) {
      expect(blobatar(s, { backgroundColor: "#000000" })).toBe(blobatar(s));
      expect(blobatar(s, { background: false, backgroundColor: "#000000" })).toBe(
        blobatar(s, { background: false }),
      );
    }
  });

  test("backgroundColor follows contrast: false", () => {
    const opts = { background: "circle", contrast: false } as const;
    for (const s of SEEDS.slice(0, 50)) {
      expect(_layout(s, { ...opts, backgroundColor: "#000000" }).palette.head).toBe(
        _layout(s, opts).palette.head,
      );
    }
  });

  test("an unmeasurable backgroundColor is painted as given", () => {
    const svg = blobatar("a", { background: "circle", backgroundColor: "var(--plate)" });
    expect(svg).toContain('fill="var(--plate)"');
    expect(_layout("a", { background: "circle", backgroundColor: "var(--plate)" }).palette.head).toBe(
      _layout("a", { background: "circle" }).palette.head,
    );
  });

  test("an empty backgroundColor is no backgroundColor", () => {
    expect(blobatar("a", { background: "circle", backgroundColor: "" })).toBe(
      blobatar("a", { background: "circle" }),
    );
  });

  test("title is escaped", () => {
    expect(blobatar("a", { title: "<script>&" })).toContain("<title>&lt;script&gt;&amp;</title>");
  });
});

describe("defs and paint", () => {
  const SKY =
    '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#818cf8"/>' +
    "</linearGradient>";
  const opts = { defs: SKY, paint: "url(#sky)" };
  const stripDefs = (svg: string) => svg.replace(/<defs>.*?<\/defs>/, "");

  test("emits the markup in a <defs> that the body is painted from", () => {
    const svg = blobatar("alain", opts);
    expect(svg).toContain(`<defs>${SKY}</defs>`);
    expect(svg).toContain('<g fill="url(#sky)">');
  });

  test("without either option the output is byte-identical to before", () => {
    for (const s of SEEDS.slice(0, 50)) {
      expect(blobatar(s, { defs: "", paint: "" })).toBe(blobatar(s));
      expect(blobatar(s, { defs: undefined, paint: undefined })).toBe(blobatar(s));
    }
  });

  test("defs alone draws nothing: no paint points at it", () => {
    for (const s of SEEDS.slice(0, 50))
      expect(stripDefs(blobatar(s, { defs: SKY }))).toBe(blobatar(s));
  });

  test("paint replaces the body's fill and moves nothing else", () => {
    // The name still drives the shape, and the eyes keep the color they were
    // resolved to: the contrast they were given is against the body's color,
    // which `paint` leaves where it is.
    for (const s of SEEDS.slice(0, 50)) {
      const plain = blobatar(s);
      const head = _layout(s).palette.head!;
      expect(blobatar(s, { paint: "url(#p)" })).toBe(
        plain.replace(`<g fill="${head}">`, '<g fill="url(#p)">'),
      );
      expect(_layout(s, { paint: "url(#p)" }).palette).toEqual(_layout(s).palette);
    }
  });

  test("paint leaves the color for a tinting expression to work from", () => {
    // The reason `paint` exists next to `palette.head`: a tint mixes colors,
    // and `url()` is not one. The eyes tint exactly as they do without it, and
    // nothing in the output is NaN.
    const e = { expression: happy };
    for (const name of ["alain", "bea", "chen"]) {
      expect(stripDefs(blobatar(name, { ...e, ...opts }))).toBe(
        blobatar(name, e).replace(/<g fill="#[0-9a-f]{6}">/, '<g fill="url(#sky)">'),
      );
    }
    const hot = { expression: mad };
    const svg = blobatar("alain", { ...hot, ...opts });
    expect(svg).not.toContain("NaN");
    expect(svg).toContain('<g fill="url(#sky)">');
    expect(svg).toContain(`<g fill="${_layout("alain", hot).palette.eye}">`);
  });

  test("comes after the title and before the backdrop", () => {
    // `<title>` names its parent only while it is the first child, and the
    // backdrop paints under the figure, so neither may be displaced.
    const svg = blobatar("alain", { ...opts, title: "Alain", background: "circle" });
    const at = (needle: string) => svg.indexOf(needle);
    expect(at("<title>")).toBeLessThan(at("<defs>"));
    expect(at("</defs>")).toBeLessThan(at("<path"));
  });

  test("survives the data uri, which is how an <img> gets it", () => {
    const uri = blobatarUri("alain", opts);
    expect(uri).not.toContain('"');
    expect(uri).not.toContain("#");
    expect(uri).not.toContain("<");
    const svg = decodeURIComponent(uri.slice("data:image/svg+xml,".length));
    expect(svg).toContain("<defs>");
    expect(svg).toContain("fill='url(#sky)'");
    expect(svg).toContain("id='sky'");
  });

  test("carries an <image> by a base64 data: URI through the data uri", () => {
    // The realistic payload for a textured body: a data URI inside an attribute
    // inside a data URI. Base64 has no quote or markup character in it, so the
    // outer encoding leaves it to decode back unchanged.
    const href = "data:image/png;base64,iVBORw0KGgo=";
    const defs = `<pattern id="skin" patternUnits="userSpaceOnUse" width="100" height="100"><image href="${href}" width="100" height="100"/></pattern>`;
    const uri = blobatarUri("alain", { defs, paint: "url(#skin)" });
    const svg = decodeURIComponent(uri.slice("data:image/svg+xml,".length));
    expect(svg).toContain(`href='${href}'`);
    expect(svg).toContain("fill='url(#skin)'");
  });

  test("leads the animated markup, inside the root", () => {
    const { inner, vars } = _parts("alain", { ...opts, animate: "always" });
    expect(inner).toStartWith(`<defs>${SKY}</defs><g class="mo-breathe">`);
    // The stylesheet fills the body from this property, so a paint reaches the
    // animated figure through it, in front of the tinted color.
    expect(vars!["--mo-head"]).toBe("url(#sky)");
    expect(_parts("alain", { animate: "always" }).vars!["--mo-head"]).toMatch(/^#[0-9a-f]{6}$/);
  });

  test("the animated markup still does not depend on the expression", () => {
    // `inner` goes to `dangerouslySetInnerHTML`; see `expression.test.ts`.
    const a = _parts("alain", { ...opts, animate: "always" }).inner;
    for (const expression of [happy, mad]) {
      expect(_parts("alain", { ...opts, animate: "always", expression }).inner).toBe(a);
    }
  });

  test("a tinting expression leaves the paint in --mo-head and tints the eyes", () => {
    const hot = _parts("alain", { ...opts, animate: "always", expression: mad }).vars!;
    const plain = _parts("alain", { animate: "always", expression: mad }).vars!;
    expect(hot["--mo-head"]).toBe("url(#sky)");
    expect(hot["--mo-eye"]).toBe(plain["--mo-eye"]);
  });
});

describe("data uri", () => {
  test("is smaller than the base64 equivalent", () => {
    const svg = blobatar("alain");
    const b64 = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
    expect(blobatarUri("alain").length).toBeLessThan(b64.length);
  });

  test("escapes every character that would break an attribute or URL", () => {
    for (const s of SEEDS.slice(0, 50)) {
      const uri = blobatarUri(s);
      expect(uri).not.toContain('"');
      expect(uri).not.toContain("#");
      expect(uri).not.toContain("<");
    }
  });
});

describe("the published surface", () => {
  test("VERSION matches package.json", async () => {
    // `VERSION` is not decoration: it is the one live binding keeping the
    // barrel from compiling to a stub that Node refuses to link. See the
    // comment on it in `src/index.ts`. Pinned here so it cannot go stale.
    const pkg = await Bun.file(
      new URL("../package.json", import.meta.url),
    ).json();
    expect(VERSION).toBe(pkg.version);
  });
});
