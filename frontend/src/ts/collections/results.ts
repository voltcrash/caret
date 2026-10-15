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
import { resultsByClient, resultsCollection } from "./results/store";
export { isResultsReady, waitForResultsReady } from "./results/store";

export {
  type ResultsQueryState,
  type ResultStats,
  type CurrentSettingsFilter,
} from "./results/types";

/** Account sign-in refreshes web history and any loaded terminal history. */
export function refetchResults(): void {
  void resultsCollection().utils.refetch();
  if (resultsByClient.tui().isReady()) {
    void resultsByClient.tui().utils.refetch();
  }
}
