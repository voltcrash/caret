import { queryOptions } from "@tanstack/solid-query";
import { Client } from "@oxytype/schemas/shared";
import { baseKey } from "./utils/keys";
import Ape from "../ape";
import { getQueryClient } from ".";
import { getSnapshot } from "../states/snapshot";

const queryKeys = {
  root: () => baseKey("profiles", { isUserSpecific: true }),
  profile: (username: string, client: Client) => [
    ...queryKeys.root(),
    username,
    client,
  ],
};

const staleTime = 1000 * 60 * 60;

export const getUserProfile = (username: string, client: Client = "web") =>
  queryOptions({
    queryKey: queryKeys.profile(username, client),
    queryFn: async () => {
      const response = await Ape.users.getProfile({
        params: { uidOrName: username },
        query: { isUid: false, client },
      });
      if (response.status !== 200) {
        throw new Error(`Could not fetch profile: ${response.body.message}`);
      }
      return response.body.data;
    },
    staleTime,
    retry: (failureCount, error) => {
      if (error.message.includes("User not found")) return false;
      return failureCount < 3;
    },
  });

export async function invalidateMyProfile(): Promise<void> {
  const username = getSnapshot()?.name;
  if (username !== undefined) {
    await getQueryClient().resetQueries({
      queryKey: [...queryKeys.root(), username],
    });
  }
}
