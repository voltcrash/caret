import { captureAccount, createAccountOwned } from "../../app/account-scope";
import type { GetUserResponse } from "@oxytype/contracts/users";
import Ape from ".";
import { getUserId } from "../states/core";
import { SnapshotInitError } from "../utils/snapshot-init-error";

type CacheType = GetUserResponse["data"];

const state = createAccountOwned(() => ({
  cache: undefined as
    | { userId: string; promise: Promise<CacheType> }
    | undefined,
}));

export async function fetchUserFromApi(
  userId = getUserId(),
): Promise<CacheType | undefined> {
  if (userId === null) return undefined;
  const lease = captureAccount();
  const current = state();
  if (current.cache?.userId !== userId) {
    current.cache = {
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
  const request = current.cache;
  try {
    const data = await request.promise;
    lease.assertCurrent();
    return data;
  } catch (error) {
    // Failed or superseded requests must not poison another user's cache.
    if (current.cache === request) current.cache = undefined;
    throw error;
  }
}
