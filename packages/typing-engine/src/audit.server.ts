import module from "#audit-module";
import { createAudit, type Audit } from "./audit";
import { resetBindings } from "../generated/audit.js";
export type * from "./audit";

let instance: Audit | undefined;

/** Server audit, instantiated on first use; the module is stateless across calls. */
export function serverAudit(): Audit {
  return (instance ??= createAudit(module));
}
/** Audit calls are synchronous and retain no Wasm-owned handles. */
export function resetServerAudit(): void {
  instance = undefined;
  resetBindings();
}
