import type { OperationId } from "./operations";

/**
 * Successful responses of these operations are shared by every caller for
 * the given seconds: their services never read the actor, so cookies and
 * tokens do not change the result. Leaderboards rebuild every 15 minutes.
 */
export const EDGE_CACHE_SECONDS: Partial<Record<OperationId, number>> = {
  "configuration.get": 30,
  "psas.get": 60,
  "public.getSpeedHistogram": 300,
  "public.getTypingStats": 60,
  "leaderboards.get": 60,
  "leaderboards.getDaily": 30,
  "leaderboards.getWeeklyXp": 30,
  "users.getProfile": 60,
};

export function edgeCacheControl(seconds: number): string {
  return `public, max-age=0, s-maxage=${seconds}`;
}
