/**
 * What a `.wasm` import is inside workerd: a compiled module, ready for
 * instantiation. wrangler's bundling provides it; this declaration only tells
 * TypeScript so.
 */
declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}
