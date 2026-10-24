import { readFileSync } from "node:fs";

// Node hosts (tests, calibration scripts) compile from bytes synchronously.
export default new WebAssembly.Module(
  readFileSync(new URL("../generated/audit_bg.wasm", import.meta.url)),
);
