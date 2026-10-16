import { createAppOwned } from "../../../../app/application";
import { appMethod } from "../../../../app/state";
import { createLiveCache } from "@oxytype/typing-core/events/live-cache";
export const getLiveCache = createAppOwned(createLiveCache);
export const getLiveCachedAccuracy = appMethod(
  () => getLiveCache().getLiveCachedAccuracy,
);
export const getLiveCachedMsSinceLastInputEvent = appMethod(
  () => getLiveCache().getLiveCachedMsSinceLastInputEvent,
);
