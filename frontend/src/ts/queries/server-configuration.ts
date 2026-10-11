import { queryOptions } from "@tanstack/solid-query";
import { baseKey } from "./utils/keys";
import Ape from "../ape";
import { envConfig } from "virtual:env-config";

const queryKeys = {
  root: () => baseKey("serverConfiguration"),
};

//only refetch once on site load
const staleTime = Infinity;

// oxlint-disable-next-line typescript/explicit-function-return-type
export const getServerConfigurationQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.root(),
    queryFn: async () => {
      if (envConfig.devOffline) {
        const { BASE_CONFIGURATION } =
          await import("@oxytype/schemas/default-configuration");
        return {
          ...BASE_CONFIGURATION,
          dailyLeaderboards: {
            ...BASE_CONFIGURATION.dailyLeaderboards,
            enabled: false,
          },
          leaderboards: {
            ...BASE_CONFIGURATION.leaderboards,
            weeklyXp: {
              ...BASE_CONFIGURATION.leaderboards.weeklyXp,
              enabled: false,
            },
          },
        };
      }
      const response = await Ape.configuration.get();

      if (response.status !== 200) {
        throw new Error(
          `Could not fetch configuration: ${response.body.message}`,
        );
      }
      return response.body.data;
    },
    staleTime,
    gcTime: Infinity,
  });
