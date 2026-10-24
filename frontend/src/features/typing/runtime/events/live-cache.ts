import { getEngineSession } from "../session.client";
export function getLiveCachedAccuracy(): number {
  return getEngineSession().liveStats().acc;
}
