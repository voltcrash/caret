import auditUrl from "../generated/audit_bg.wasm?url";
import { createAudit, type Audit } from "./audit";
export type * from "./audit";

/** Fetch and instantiate the audit module. The caller's owner retains it. */
export async function loadAudit(signal?: AbortSignal): Promise<Audit> {
  signal?.throwIfAborted();
  const response = await fetch(auditUrl, { signal });
  if (!response.ok) {
    throw new Error(`Typing audit download failed: ${response.status}`);
  }
  const compiled =
    typeof WebAssembly.compileStreaming === "function"
      ? await WebAssembly.compileStreaming(response)
      : await WebAssembly.compile(await response.arrayBuffer());
  signal?.throwIfAborted();
  return createAudit(compiled);
}
