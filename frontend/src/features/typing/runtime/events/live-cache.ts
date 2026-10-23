import { getEngineSession } from "../session.client";
export function getLiveCachedAccuracy(): number {
  return getEngineSession().liveStats().acc;
}
export function getLiveCachedMsSinceLastInputEvent(): number | undefined {
  return getEngineSession().liveStats().msSinceLastInput ?? undefined;
}
