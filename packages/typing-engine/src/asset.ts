// SSR-safe URL metadata. Importing this never loads or initializes WebAssembly.
export { default as wasmUrl } from "../generated/engine_bg.wasm?url";
