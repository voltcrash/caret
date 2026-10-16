import { currentApplication } from "./application";
import { createAppSignal } from "./state";

/** This tab's build; the Worker and `/version.json` report the deployed one. */
export const clientBuildId = import.meta.env.OXYTYPE_BUILD_ID;

/** Response header marking a request this build's Worker cannot serve. */
export const staleClientHeader = "X-Oxytype-Stale-Client";

/**
 * Why this tab can no longer talk to the deployment: a server function or
 * code-split chunk from its build is gone. Only a refresh recovers.
 */
export type StaleReason = "function" | "chunk";

const [staleClient, setStaleClient] = createAppSignal<StaleReason | undefined>(
  undefined,
);

export { staleClient };

/** First reason wins; reports outside a mounted browser app are ignored. */
export function reportStaleClient(reason: StaleReason): void {
  if (currentApplication() === undefined) return;
  if (staleClient() === undefined) setStaleClient(reason);
}
