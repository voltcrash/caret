import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Node hosts (tests, calibration scripts) compile from bytes synchronously.
// dirname rather than import.meta.url: DOM test environments rewrite the URL.
export default new WebAssembly.Module(
  readFileSync(resolve(import.meta.dirname, "../generated/audit_bg.wasm")),
);
