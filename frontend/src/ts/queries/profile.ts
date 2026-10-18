import { baseKey } from "./utils/keys";
import { getQueryClient } from ".";
import { getSnapshot } from "../states/snapshot";

const queryKeys = {
  root: () => baseKey("profiles", { isUserSpecific: true }),
};

export async function invalidateMyProfile(): Promise<void> {
  const username = getSnapshot()?.name;
  if (username !== undefined) {
    await Promise.all([
      getQueryClient().resetQueries({
        queryKey: [...queryKeys.root(), username],
      }),
      // Start's public profile route cache.
      getQueryClient().resetQueries({
        queryKey: ["public", "profile", username],
      }),
    ]);
  }
}
