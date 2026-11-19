import { getQueryClient } from "../../data/queries";
import { getSnapshot } from "../../ts/states/snapshot";
import { profileKey } from "./queries";

/** Refetch the signed-in user's public profile after they edit it. */
export async function invalidateMyProfile(): Promise<void> {
  const username = getSnapshot()?.name;
  if (username === undefined) return;
  await getQueryClient().resetQueries({ queryKey: profileKey(username) });
}
