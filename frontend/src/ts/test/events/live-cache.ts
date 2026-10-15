import { createAppOwned } from "../../../app/application";
import { appMethod, appObject } from "../../../app/state";
import { createLiveCache } from "@oxytype/typing-core/events/live-cache";
export const getLiveCache = createAppOwned(createLiveCache);
export const liveCache = appObject(getLiveCache);
export const getLiveCachedAccuracy = appMethod(
  () => liveCache.getLiveCachedAccuracy,
);
export const getLiveCachedMsSinceLastInputEvent = appMethod(
  () => liveCache.getLiveCachedMsSinceLastInputEvent,
);
