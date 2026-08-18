/**
 * The Cloudflare entry: wires the real runtime into the pure handler and
 * decides nothing. Every branch lives in `handler.ts`, where `bun test`
 * reaches it; this file is covered by running `wrangler dev`.
 */
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import { blobatar } from "blobatar";

import { handleRequest, type WorkerCache } from "./handler";

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

/** One wasm init per isolate, shared by every request it serves. */
let wasmReady: Promise<void> | undefined;

export default {
  fetch(request: Request, _env: unknown, ctx: ExecutionContext): Promise<Response> {
    wasmReady ??= initWasm(resvgWasm);
    return handleRequest(request, {
      // workerd's caches carries `.default`; the DOM lib type does not know it.
      cache: (caches as unknown as { default: WorkerCache }).default,
      waitUntil: (promise) => ctx.waitUntil(promise),
      render: blobatar,
      rasterize: async (svg, size) => {
        await wasmReady;
        const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
        return png as Uint8Array<ArrayBuffer>;
      },
    });
  },
};
