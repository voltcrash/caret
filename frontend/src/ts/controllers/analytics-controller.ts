/** Optional host-provided Google Analytics; authentication has no analytics SDK. */
let enabled = false;
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
  if (enabled) (window as AnalyticsWindow).gtag?.("event", eventName, params);
}
export function activateAnalytics(): void {
  enabled = true;
}

export function deactivateAnalytics(): void {
  enabled = false;
}
