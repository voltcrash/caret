import { currentApplication } from "./application";
import { createAppSignal } from "./state";

/** This tab's build; the Worker and `/version.json` report the deployed one. */
export const clientBuildId = import.meta.env.OXYTYPE_BUILD_ID;

/**
 * Why this tab is out of date: a server function or code-split chunk from its
 * build is gone (it may already be failing), or a newer build is deployed.
 * Only a refresh recovers.
 */
export type StaleReason = "function" | "chunk" | "deployed";

const [staleClient, setStaleClient] = createAppSignal<StaleReason | undefined>(
  undefined,
);

export { staleClient };

/** Broken builds outrank a merely newer one; ignored outside a mounted app. */
export function reportStaleClient(reason: StaleReason): void {
  if (currentApplication() === undefined) return;
  const current = staleClient();
  if (current === undefined || (current === "deployed" && reason !== current)) {
    setStaleClient(reason);
  }
}
