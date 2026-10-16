import { queryOptions } from "@tanstack/solid-query";
import { operationData } from "../../data/operations";
import { baseKey } from "./utils/keys";

export function getRemotePreferencesQueryOptions() {
  return queryOptions({
    queryKey: baseKey("preferences", { isUserSpecific: true }),
    queryFn: async () => await operationData("configs.get"),
    staleTime: 0,
    retry: false,
  });
}
