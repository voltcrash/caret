import { queryOptions } from "@tanstack/solid-query";
import { operationData } from "../../data/operations";

export function getPsaQueryOptions() {
  return queryOptions({
    queryKey: ["psas"],
    queryFn: async () => await operationData("psas.get"),
    staleTime: 0,
    retry: false,
  });
}
