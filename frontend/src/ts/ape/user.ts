import type { GetUserResponse } from "@oxytype/contracts/users";
import Ape from ".";
import { createModuleEffectOn } from "../hooks/effects";
import { getUserId } from "../states/core";
import { SnapshotInitError } from "../utils/snapshot-init-error";

type CacheType = GetUserResponse["data"];

let cache: { userId: string; promise: Promise<CacheType> } | undefined;

export async function fetchUserFromApi(
  userId = getUserId(),
): Promise<CacheType | undefined> {
  if (userId === null) return undefined;
  if (cache?.userId !== userId) {
    cache = {
      userId,
      promise: (async () => {
        const response = await Ape.users.get();
        if (response.status !== 200) {
          throw new SnapshotInitError(
            `${response.body.message} (user)`,
            response.status,
          );
        }
        return response.body.data;
      })(),
    };
  }
  const request = cache;
  try {
    return await request.promise;
  } catch (error) {
    // Failed or superseded requests must not poison another user's cache.
    if (cache === request) cache = undefined;
    throw error;
  }
}

// clear cache + reset promise on logout
createModuleEffectOn(import.meta.hot, getUserId, (userId) => {
  if (cache?.userId !== userId) cache = undefined;
});
