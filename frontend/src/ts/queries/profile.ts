import { queryOptions } from "@tanstack/solid-query";
import { Client } from "@oxytype/schemas/shared";
import { baseKey } from "./utils/keys";
import { operation } from "../../data/operations";
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
      const response = await operation("users.getProfile", {
        params: { uidOrName: username },
        query: { isUid: false, client },
      });
      if (!response.ok) {
        throw new Error(`Could not fetch profile: ${response.message}`);
      }
      return response.data;
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
