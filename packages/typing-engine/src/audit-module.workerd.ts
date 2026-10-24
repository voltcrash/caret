// Workers forbid compiling Wasm from bytes at runtime; the bundler uploads
// this module and the runtime hands it over precompiled.
export { default } from "../generated/audit_bg.wasm?module";
