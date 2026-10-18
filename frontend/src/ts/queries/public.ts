import { queryOptions } from "@tanstack/solid-query";
import { getContributorsList } from "../utils/json-data";
import { baseKey } from "./utils/keys";

const queryKeys = {
  root: () => baseKey("public"),
  contributors: () => [...queryKeys.root(), "contributors"],
};

//cache results for one hour
const staleTime = 1000 * 60 * 60;

export const getContributorsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.contributors(),
    queryFn: getContributorsList,
    staleTime,
  });
