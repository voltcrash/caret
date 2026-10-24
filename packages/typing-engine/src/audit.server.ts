import module from "#audit-module";
import { createAudit, type Audit } from "./audit";
export type * from "./audit";

let instance: Audit | undefined;

/** Server audit, instantiated on first use; the module is stateless across calls. */
export function serverAudit(): Audit {
  return (instance ??= createAudit(module));
}
