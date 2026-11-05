import { createAppOwned } from "../../app/application";
/** Optional host-provided Google Analytics; authentication has no analytics SDK. */
const state = createAppOwned(() => ({ enabled: false }));
type AnalyticsWindow = Window & {
  gtag?: (
    command: string,
    name: string,
    params?: Record<string, string>,
  ) => void;
};
export async function log(
  eventName: string,
  params?: Record<string, string>,
): Promise<void> {
  if (state().enabled)
    (window as AnalyticsWindow).gtag?.("event", eventName, params);
}
export function activateAnalytics(): void {
  state().enabled = true;
}

export function deactivateAnalytics(): void {
  state().enabled = false;
}
