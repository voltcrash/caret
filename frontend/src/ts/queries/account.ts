import { Client } from "@oxytype/schemas/shared";
import { queryOptions } from "@tanstack/solid-query";

import Ape from "../ape";
import { baseKey } from "./utils/keys";
import { getQueryClient } from ".";
import { getUserId } from "../states/core";

export async function updateTerminalLeaderboardMemory(
  mode2: string,
  rank: number,
): Promise<void> {
  const key = getAccountQueryOptions("tui").queryKey;
  const response = await Ape.users.updateLeaderboardMemory({
    query: { client: "tui" },
    body: { mode: "time", mode2, language: "english", rank },
  });
  if (response.status !== 200) throw new Error(response.body.message);
  getQueryClient().setQueryData(key, (data) =>
    data === undefined
      ? data
      : {
          ...data,
          lbMemory: {
            ...data.lbMemory,
            time: {
              ...data.lbMemory?.time,
              [mode2]: { ...data.lbMemory?.time?.[mode2], english: rank },
            },
          },
        },
  );
}

export function getAccountQueryOptions(client: Client) {
  return queryOptions({
    queryKey: [
      ...baseKey("account", { isUserSpecific: true }),
      getUserId(),
      client,
    ],
    queryFn: async () => {
      const response = await Ape.users.get({ query: { client } });
      if (response.status !== 200) throw new Error(response.body.message);
      const data = response.body.data;
      return {
        ...data,
        details: data.profileDetails,
        typingStats: {
          startedTests: data.startedTests ?? 0,
          completedTests: data.completedTests ?? 0,
          timeTyping: data.timeTyping ?? 0,
        },
        streak: data.streak?.length ?? 0,
        maxStreak: data.streak?.maxLength ?? 0,
      };
    },
    staleTime: 30_000,
  });
}

export function getAccountActivityQueryOptions(client: Client) {
  return queryOptions({
    queryKey: [
      ...baseKey("activity", { isUserSpecific: true }),
      getUserId(),
      client,
    ],
    queryFn: async () => {
      const response = await Ape.users.getTestActivity({ query: { client } });
      if (response.status !== 200) throw new Error(response.body.message);
      return response.body.data;
    },
    staleTime: 30_000,
  });
}
