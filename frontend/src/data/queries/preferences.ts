import { queryOptions } from "@tanstack/solid-query";
import { operationData } from "../operations";
import { baseKey } from "./keys";

export function getRemotePreferencesQueryOptions() {
  return queryOptions({
    queryKey: baseKey("preferences", { isUserSpecific: true }),
    queryFn: async () => await operationData("configs.get"),
    staleTime: 0,
    retry: false,
  });
}
