export {
  useUserAverage10LiveQuery,
  getResultsSinceDayOnce,
  getUserAverage10Once,
  getUserDailyBestOnce,
} from "./results/settings";
export { useResultStatsLiveQuery } from "./results/stats";

export {
  getResultsQueryOnce,
  useResultsLiveQuery,
  buildResultsQuery,
  getSingleResultQueryOptions,
} from "./results/queries";
export { createResultsQueryState } from "./results/filters";
export {
  updateTags,
  insertLocalResult,
  deleteLocalTag,
} from "./results/mutations";
import { resultsCollection } from "./results/store";
export { isResultsReady, waitForResultsReady } from "./results/store";

export {
  type ResultsQueryState,
  type ResultStats,
  type CurrentSettingsFilter,
} from "./results/types";

/** Refresh account history after sign-in. */
export async function refetchResults(): Promise<void> {
  await resultsCollection().utils.refetch();
}
