import { createLiveCache } from "@oxytype/typing-core/events/live-cache";
export const liveCache = createLiveCache();
export const {
  getLiveCachedAccuracy,
  getLiveCachedMsSinceLastInputEvent,
  getLiveCachedTestDurationMs,
  getLiveCachedTestSeconds,
} = liveCache;
