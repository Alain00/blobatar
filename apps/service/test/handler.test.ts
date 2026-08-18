/**
 * The pure handler, hit as a consumer hits it: a Request in, a Response out.
 * The injected fakes replicate the semantics of Cloudflare's own test-context
 * pattern in ~20 lines; the branch-free entry that wires the real runtime is
 * covered manually via `wrangler dev`.
 *
 * Param-table correctness (values, ranges, messages) is render-core's suite —
 * here params only appear as integration: one accepted, one rejected, and the
 * cache-key equivalences.
 */
import { describe, expect, test } from "bun:test";
import type { BlobatarOptions } from "blobatar";

import { handleRequest, type HandlerDeps } from "../src/handler";

function fakes() {
  const store = new Map<string, Response>();
  const pending: Promise<unknown>[] = [];
  const rendered: { name: string; options: BlobatarOptions }[] = [];
  const deps: HandlerDeps = {
    cache: {
      match: async (key) => store.get(key)?.clone(),
      put: async (key, response) => void store.set(key, response),
    },
    waitUntil: (promise) => void pending.push(promise),
    render: (name, options) => {
      rendered.push({ name, options });
      return `<svg>${name}|${JSON.stringify(options)}</svg>`;
    },
    rasterize: async (svg, size) => new TextEncoder().encode(`png@${size}|${svg}`),
  };
  // Settles everything handed to waitUntil — what the runtime does after the
  // response has already gone out.
  const settle = () => Promise.all(pending).then(() => undefined);
  return { deps, store, rendered, settle };
}

const request = (path: string, init?: RequestInit) =>
  new Request(`https://service.example${path}`, init);

describe("GET /v1/:name.svg", () => {
  test("serves an immutable, hygienic SVG", async () => {
    const { deps, rendered, settle } = fakes();
    const res = await handleRequest(request("/v1/alain.svg"), deps);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'; style-src 'unsafe-inline'",
    );
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await res.text()).toBe("<svg>alain|{}</svg>");
    expect(rendered).toEqual([{ name: "alain", options: {} }]);
    await settle();
  });

  test("size on SVG reaches the render options", async () => {
    const { deps, rendered } = fakes();
    await handleRequest(request("/v1/alain.svg?size=512"), deps);
    expect(rendered).toEqual([{ name: "alain", options: { size: 512 } }]);
  });
});

describe("GET /v1/:name.png", () => {
  test("rasterizes at 256 by default, without size attributes on the source", async () => {
    const { deps, rendered } = fakes();
    const res = await handleRequest(request("/v1/alain.png"), deps);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
    expect(await res.text()).toBe("png@256|<svg>alain|{}</svg>");
    expect(rendered).toEqual([{ name: "alain", options: {} }]);
  });

  test("honors ?size as the raster width, never as markup", async () => {
    const { deps, rendered } = fakes();
    const res = await handleRequest(request("/v1/alain.png?size=512"), deps);
    expect(await res.text()).toBe("png@512|<svg>alain|{}</svg>");
    expect(rendered).toEqual([{ name: "alain", options: {} }]);
  });
});

describe("routing", () => {
  test("HEAD is handled as GET — the runtime strips the body", async () => {
    const { deps } = fakes();
    const res = await handleRequest(request("/v1/alain.svg", { method: "HEAD" }), deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml; charset=utf-8");
  });

  test("any other method is a 405 that names what is allowed", async () => {
    const { deps, rendered } = fakes();
    for (const method of ["POST", "PUT", "DELETE"]) {
      const res = await handleRequest(request("/v1/alain.svg", { method }), deps);
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("GET, HEAD");
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
    expect(rendered).toEqual([]);
  });

  test("any other path is a 404 with a one-line usage hint", async () => {
    const { deps } = fakes();
    for (const path of ["/", "/v1/alain", "/v1/alain.gif", "/v2/alain.svg", "/v1/a/b.svg"]) {
      const res = await handleRequest(request(path), deps);
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
      expect(await res.text()).toContain("/v1/:name.svg");
    }
  });
});

describe("bad requests", () => {
  const bad = async (path: string) => {
    const { deps, rendered } = fakes();
    const res = await handleRequest(request(path), deps);
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    // 400 means *before any rendering* — cache poisoning and wasted CPU both die here.
    expect(rendered).toEqual([]);
    return res.text();
  };

  test("malformed percent-encoding in the name", async () => {
    // The reference implementation 500ed here; the decode is guarded.
    expect(await bad("/v1/%E0%A4%A.svg")).toBe("name is not valid percent-encoding");
  });

  test("name longer than 256 characters after decoding", async () => {
    expect(await bad(`/v1/${"a".repeat(257)}.svg`)).toBe(
      "name must be at most 256 characters",
    );
  });

  test("name empty after normalization", async () => {
    // A name stands for somebody; empty is a caller bug, not a face.
    expect(await bad("/v1/%20%20.svg")).toBe("name must not be empty");
  });

  test("empty name is only reachable when normalization trims it", async () => {
    // With normalize=false the same whitespace is a legitimate, verbatim seed.
    const { deps, rendered } = fakes();
    const res = await handleRequest(request("/v1/%20%20.svg?normalize=false"), deps);
    expect(res.status).toBe(200);
    expect(rendered).toEqual([{ name: "  ", options: { normalize: false } }]);
  });

  test("an invalid param value surfaces render-core's message verbatim", async () => {
    expect(await bad("/v1/alain.svg?hue=999")).toBe(
      "hue must be an integer between 0 and 360",
    );
  });
});

describe("caching", () => {
  test("a second equivalent request is served from cache without rendering", async () => {
    const { deps, rendered, settle } = fakes();
    const first = await handleRequest(request("/v1/alain.svg"), deps);
    await settle();
    const second = await handleRequest(request("/v1/alain.svg"), deps);

    expect(rendered).toHaveLength(1);
    expect(await second.text()).toBe(await first.text());
    expect(second.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });

  test("the cache write rides waitUntil, never the response", async () => {
    const { deps, store, settle } = fakes();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const put = deps.cache.put;
    deps.cache.put = async (key, response) => {
      await gate;
      return put(key, response);
    };

    const res = await handleRequest(request("/v1/alain.svg"), deps);
    expect(res.status).toBe(200);
    expect(store.size).toBe(0);

    release();
    await settle();
    expect(store.size).toBe(1);
  });
});

describe("canonical cache key", () => {
  /** The single key a request stores under. */
  const keyOf = async (path: string, host = "https://service.example") => {
    const { deps, store, settle } = fakes();
    await handleRequest(new Request(`${host}${path}`), deps);
    await settle();
    expect(store.size).toBe(1);
    return [...store.keys()][0]!;
  };

  test("param order does not fragment the cache", async () => {
    expect(await keyOf("/v1/alain.svg?tone=40&hue=210")).toBe(
      await keyOf("/v1/alain.svg?hue=210&tone=40"),
    );
  });

  test("params byte-equivalent to their absence are stripped", async () => {
    const bare = await keyOf("/v1/alain.svg");
    expect(await keyOf("/v1/alain.svg?expression=idle")).toBe(bare);
    expect(await keyOf("/v1/alain.svg?normalize=true")).toBe(bare);
    expect(await keyOf("/v1/alain.svg?background=none")).toBe(bare);
    // size=256 is a default on PNG only; on SVG it emits attributes.
    expect(await keyOf("/v1/alain.png?size=256")).toBe(await keyOf("/v1/alain.png"));
    expect(await keyOf("/v1/alain.svg?size=256")).not.toBe(bare);
  });

  test("params that change bytes each get their own entry", async () => {
    const bare = await keyOf("/v1/alain.svg");
    expect(await keyOf("/v1/alain.svg?expression=happy")).not.toBe(bare);
    expect(await keyOf("/v1/alain.svg?hue=210")).not.toBe(bare);
    expect(await keyOf("/v1/alain.png")).not.toBe(bare);
  });

  test("unknown params are ignored, never keyed", async () => {
    expect(await keyOf("/v1/alain.svg?utm_source=x&fbclid=y&key=abc")).toBe(
      await keyOf("/v1/alain.svg"),
    );
  });

  test("the name is keyed as the library will hash it", async () => {
    expect(await keyOf("/v1/Alain.svg")).toBe(await keyOf("/v1/alain.svg"));
    expect(await keyOf("/v1/%20alain%20.svg")).toBe(await keyOf("/v1/alain.svg"));
    // normalize=false keys the verbatim name — distinct ids stay distinct.
    expect(await keyOf("/v1/Alain.svg?normalize=false")).not.toBe(
      await keyOf("/v1/alain.svg?normalize=false"),
    );
  });

  test("the key never carries the request's host", async () => {
    const a = await keyOf("/v1/alain.svg", "https://avatars.blobatar.dev");
    const b = await keyOf("/v1/alain.svg", "https://acme.blobatar.dev");
    expect(a).toBe(b);
    expect(a).not.toContain("blobatar.dev");
  });

  test("two hosts share one live cache entry", async () => {
    const { deps, rendered, settle } = fakes();
    await handleRequest(new Request("https://a.example/v1/alain.svg"), deps);
    await settle();
    await handleRequest(new Request("https://b.example/v1/alain.svg"), deps);
    expect(rendered).toHaveLength(1);
  });
});
